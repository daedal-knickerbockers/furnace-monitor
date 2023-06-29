import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import { LocalDatabaseConfig } from "./Config";
import { ConsumerRuntime, ConsumerState } from "./Consumer";

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
    isSavedRemotely: boolean;
    // expiresISO?: string;
    // expiresTimestamp?: number;
};

export type ConsumerRuntimeKeys = Array<{ consumerName: string; startedTimestamp: number }>;

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

    public async createConsumerState(consumerState: ConsumerState): Promise<void> {
        await this.db.run(
            `
            INSERT INTO consumer_state (
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
            FROM consumer_state
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
            INSERT INTO consumer_runtime (
                consumerName,
                startedISO,
                startedTimestamp,
                stoppedISO,
                stoppedTimestamp,
                durationSeconds,
                isSavedRemotely
            ) VALUES (
                $consumerName,
                $startedISO,
                $startedTimestamp,
                $stoppedISO,
                $stoppedTimestamp,
                $durationSeconds,
                $isSavedRemotely
            );
            `,
            {
                $consumerName: consumerRuntime.consumerName,
                $startedISO: consumerRuntime.startedDate.toISOString(),
                $startedTimestamp: consumerRuntime.startedDate.getTime(),
                $stoppedISO: consumerRuntime.stoppedDate.toISOString(),
                $stoppedTimestamp: consumerRuntime.stoppedDate.getTime(),
                $durationSeconds: consumerRuntime.durationSeconds,
                $isSavedRemotely: false,
            },
        );
    }

    public async getConsumerRuntimes(filters?: { isSavedRemotely?: boolean }, limit = 100): Promise<ConsumerRuntime[]> {
        let whereClause = "";
        const whereParams: Record<string, unknown> = {};
        if (filters?.isSavedRemotely !== undefined) {
            whereParams.$isSavedRemotely = filters.isSavedRemotely;
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
            FROM consumer_runtime
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

    public async markConsumerRuntimesSavedRemotely(consumerRuntimeKeys: ConsumerRuntimeKeys): Promise<void> {
        if (consumerRuntimeKeys.length === 0) {
            return;
        }

        await this.db.exec(
            `
            UPDATE consumer_runtime
            SET isSavedRemotely = 1
            WHERE (consumerName, startedTimestamp) IN ( VALUES
                ${consumerRuntimeKeys.map((key) => `("${key.consumerName}", ${key.startedTimestamp})`).join(",")}
            )
        `,
        );
    }

    private async createTables(): Promise<void> {
        await this.createConsumerStateTable();
        await this.createConsumerRuntimeTable();
    }

    private async createConsumerStateTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_state (
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

    private async createConsumerRuntimeTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_runtime (
                consumerName TEXT NOT NULL,
                startedISO TEXT NOT NULL,
                startedTimestamp INTEGER NOT NULL,
                stoppedISO TEXT NOT NULL,
                stoppedTimestamp INTEGER NOT NULL,
                durationSeconds INTEGER NOT NULL,
                isSavedRemotely INTEGER DEFAULT 0,
                expiresISO TEXT,
                expiresTimestamp INTEGER,
                PRIMARY KEY (consumerName, startedTimestamp)
            );
        `);
    }
}
