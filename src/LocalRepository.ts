import { Database, Statement, open } from "sqlite";
import sqlite3 from "sqlite3";
import { LocalDatabaseConfig } from "./Config";
import { AggregationInterval, ConsumerRuntime, ConsumerRuntimeAggregate, ConsumerState } from "./Consumer";
import { DatabaseTransaction } from "./DatabaseTransaction";

export type ConsumerStateDBO = Omit<ConsumerState, "stateChangeDate"> & {
    stateChangeISO: string;
    stateChangeTimestamp: number;
    // expiresISO?: string;
    // expiresTimestamp?: number;
};

export type ConsumerRuntimeDBO = Omit<ConsumerRuntime, "startedDate" | "stoppedDate"> & {
    startedISO: string;
    startedTimestamp: number;
    stoppedISO: string;
    stoppedTimestamp: number;
    isAggregated: boolean;
    // expiresISO?: string;
    // expiresTimestamp?: number;
};

export type ConsumerRuntimeAggregateDBO = Omit<ConsumerRuntimeAggregate, "startedDate"> & {
    startedISO: string;
    startedTimestamp: number;
    // expiresISO?: string;
    // expiresTimestamp?: number;
};

export type ConsumerRuntimeKey = { consumerName: string; startedTimestamp: number };
export type ConsumerRuntimeKeys = ConsumerRuntimeKey[];
export type PatchCustomerRuntimeInput = {
    key: ConsumerRuntimeKey;
    data: Partial<Pick<ConsumerRuntimeDBO, "isAggregated">>;
};

export class LocalRepository {
    private db: Database;

    public constructor(private readonly config: LocalDatabaseConfig) {
        //
    }

    public async init(): Promise<void> {
        this.db = await open({
            filename: this.config.filePath,
            driver: sqlite3.Database,
        });

        await this.createTables();
    }

    public async runMany(statements: Statement[]): Promise<void> {
        const transaction = new DatabaseTransaction(this.db);
        await transaction.runBatchAsync(statements);
    }

    public async createConsumerState(consumerState: ConsumerState): Promise<void> {
        await this.db.run(
            `
            INSERT INTO consumer_states (
                consumerName,
                stateChangeISO,
                stateChangeTimestamp,
                state
            ) VALUES (
                $consumerName,
                $stateChangeISO,
                $stateChangeTimestamp,
                $state
            );
        `,
            {
                $consumerName: consumerState.consumerName,
                $stateChangeISO: consumerState.stateChangeDate.toISOString(),
                $stateChangeTimestamp: consumerState.stateChangeDate.getTime(),
                $state: consumerState.state,
            },
        );
    }

    public async getLatestConsumerStateBeforeTimestamp(
        consumerName: string,
        timestamp: number,
    ): Promise<ConsumerState | undefined> {
        const consumerStateDBO = await this.db.get<ConsumerStateDBO>(
            `
            SELECT *
            FROM consumer_states
            WHERE consumerName = $consumerName
            AND stateChangeTimestamp < $timestamp
            ORDER BY stateChangeTimestamp DESC
            LIMIT 1;
        `,
            {
                $consumerName: consumerName,
                $timestamp: timestamp,
            },
        );
        let consumerState: ConsumerState | undefined;
        if (consumerStateDBO) {
            consumerState = {
                consumerName: consumerStateDBO.consumerName,
                stateChangeDate: new Date(consumerStateDBO.stateChangeISO),
                state: consumerStateDBO.state,
            };
        }
        return consumerState;
    }

    public async createConsumerRuntime(consumerRuntime: ConsumerRuntime): Promise<void> {
        await this.db.run(
            `
            INSERT INTO consumer_runtimes (
                consumerName,
                startedISO,
                startedTimestamp,
                stoppedISO,
                stoppedTimestamp,
                durationSeconds,
                isAggregated
            ) VALUES (
                $consumerName,
                $startedISO,
                $startedTimestamp,
                $stoppedISO,
                $stoppedTimestamp,
                $durationSeconds,
                $isAggregated
            );
            `,
            {
                $consumerName: consumerRuntime.consumerName,
                $startedISO: consumerRuntime.startedDate.toISOString(),
                $startedTimestamp: consumerRuntime.startedDate.getTime(),
                $stoppedISO: consumerRuntime.stoppedDate.toISOString(),
                $stoppedTimestamp: consumerRuntime.stoppedDate.getTime(),
                $durationSeconds: consumerRuntime.durationSeconds,
                $isAggregated: false,
            },
        );
    }

    public async getConsumerRuntimes(
        filters?: { consumerName?: string; isAggregated?: boolean },
        limit = 100,
    ): Promise<ConsumerRuntime[]> {
        let whereClause = "";
        const whereParams: Record<string, unknown> = {};
        if (filters?.isAggregated !== undefined) {
            whereParams.$isAggregated = filters.isAggregated;
        }
        if (filters?.consumerName) {
            whereParams.$consumerName = filters.consumerName;
        }

        if (Object.keys(whereParams).length > 0) {
            whereClause =
                "WHERE " +
                Object.keys(whereParams)
                    .map((key) => `${key.slice(1)} = ${key}`)
                    .join(" AND ");
        }

        const consumerRuntimeDBOs = await this.db.all<ConsumerRuntimeDBO[]>(
            `
            SELECT *
            FROM consumer_runtimes
            ${whereClause}
            ORDER BY startedTimestamp DESC
            LIMIT $limit;
        `,
            {
                ...whereParams,
                $limit: Math.min(limit, 100),
            },
        );

        const consumerRuntimes: ConsumerRuntime[] = [];
        if (consumerRuntimeDBOs) {
            for (const consumerRuntimeDBO of consumerRuntimeDBOs) {
                consumerRuntimes.push({
                    consumerName: consumerRuntimeDBO.consumerName,
                    startedDate: new Date(consumerRuntimeDBO.startedISO),
                    stoppedDate: new Date(consumerRuntimeDBO.stoppedISO),
                    durationSeconds: consumerRuntimeDBO.durationSeconds,
                });
            }
        }
        return consumerRuntimes;
    }

    public async createPatchCustomerRuntimeStatement(patch: PatchCustomerRuntimeInput): Promise<Statement> {
        const setStrings: string[] = [];
        const params: Record<string, unknown> = {
            $consumerName: patch.key.consumerName,
            $startedTimestamp: patch.key.startedTimestamp,
        };
        for (const [key, value] of Object.entries(patch.data)) {
            setStrings.push(`${key} = $${key}`);
            params[`$${key}`] = value;
        }
        return await this.db.prepare(
            `
            UPDATE consumer_runtimes
            SET ${setStrings.join(", ")}
            WHERE consumerName = $consumerName
            AND startedTimestamp = $startedTimestamp;
            `,
            params,
        );
    }

    public async patchCustomerRuntime(patch: PatchCustomerRuntimeInput): Promise<void> {
        const statement = await this.createPatchCustomerRuntimeStatement(patch);
        await statement.run();
        await statement.finalize();
    }

    public async createUpsertConsumerRuntimeAggregateStatement(consumerRuntimeAggregate: ConsumerRuntimeAggregate) {
        return await this.db.prepare(
            `
            INSERT INTO consumer_runtime_aggregates (
                consumerName,
                startedISO,
                startedTimestamp,
                durationSeconds,
                interval
            ) VALUES (
                $consumerName,
                $startedISO,
                $startedTimestamp,
                $durationSeconds,
                $interval
            )
            ON CONFLICT (consumerName, startedTimestamp) DO UPDATE SET
                durationSeconds = $durationSeconds;
            `,
            {
                $consumerName: consumerRuntimeAggregate.consumerName,
                $startedISO: consumerRuntimeAggregate.startedDate.toISOString(),
                $startedTimestamp: consumerRuntimeAggregate.startedDate.getTime(),
                $durationSeconds: consumerRuntimeAggregate.durationSeconds,
                $interval: consumerRuntimeAggregate.interval,
            },
        );
    }

    public async upsertConsumerRuntimeAggregate(consumerRuntimeAggregate: ConsumerRuntimeAggregate): Promise<void> {
        const statement = await this.createUpsertConsumerRuntimeAggregateStatement(consumerRuntimeAggregate);
        await statement.run();
        await statement.finalize();
    }

    public async getConsumerRuntimeAggregate(
        consumerName: string,
        startedDate: Date,
        interval: AggregationInterval,
    ): Promise<ConsumerRuntimeAggregate | undefined> {
        const consumerRuntimeAggregateDBO = await this.db.get<ConsumerRuntimeAggregateDBO>(
            `
            SELECT *
            FROM consumer_runtime_aggregates
            WHERE consumerName = $consumerName
            AND startedTimestamp = $startedTimestamp
            AND interval = $interval
            LIMIT 1;
        `,
            {
                $consumerName: consumerName,
                $startedTimestamp: startedDate.getTime(),
                $interval: interval,
            },
        );

        let consumerRuntimeAggregate: ConsumerRuntimeAggregate | undefined;
        if (consumerRuntimeAggregateDBO) {
            consumerRuntimeAggregate = {
                consumerName: consumerRuntimeAggregateDBO.consumerName,
                startedDate: new Date(consumerRuntimeAggregateDBO.startedISO),
                durationSeconds: consumerRuntimeAggregateDBO.durationSeconds,
                interval: consumerRuntimeAggregateDBO.interval,
            };
        }
        return consumerRuntimeAggregate;
    }

    private async createTables(): Promise<void> {
        await this.createConsumerStatesTable();
        await this.createConsumerRuntimesTable();
        await this.createConsumerRuntimeAggregatesTable();
    }

    private async createConsumerStatesTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_states (
                consumerName TEXT NOT NULL,
                stateChangeISO TEXT NOT NULL,
                stateChangeTimestamp INTEGER NOT NULL,
                state INTEGER NOT NULL,
                expiresISO TEXT,
                expiresTimestamp INTEGER,
                PRIMARY KEY (consumerName, stateChangeTimestamp)
            );
        `);
    }

    private async createConsumerRuntimesTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_runtimes (
                consumerName TEXT NOT NULL,
                startedISO TEXT NOT NULL,
                startedTimestamp INTEGER NOT NULL,
                stoppedISO TEXT NOT NULL,
                stoppedTimestamp INTEGER NOT NULL,
                durationSeconds INTEGER NOT NULL,
                isAggregated INTEGER DEFAULT 0,
                expiresISO TEXT,
                expiresTimestamp INTEGER,
                PRIMARY KEY (consumerName, startedTimestamp)
            );
        `);
    }

    private async createConsumerRuntimeAggregatesTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_runtime_aggregates (
                consumerName TEXT NOT NULL,
                startedISO TEXT NOT NULL,
                startedTimestamp INTEGER NOT NULL,
                durationSeconds INTEGER NOT NULL,
                interval TEXT NOT NULL,
                expiresISO TEXT,
                expiresTimestamp INTEGER,
                PRIMARY KEY (consumerName, startedTimestamp)
            );
        `);
    }
}
