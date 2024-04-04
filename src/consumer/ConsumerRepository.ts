import { Statement } from "sqlite";
import { Database } from "../database/Database";
import { DatabaseTransaction } from "../database/DatabaseTransaction";
import { ConsumerState } from "./Consumer";

export type ConsumerStateDBO = Omit<ConsumerState, "stateChangeDate"> & {
    stateChangeISO: string;
    stateChangeTimestamp: number;
};

export class ConsumerRepository {
    public constructor(private readonly database: Database) {
        //
    }

    public async init(): Promise<void> {
        await this.createConsumerStatesTable();
    }

    public async runMany(statements: Statement[]): Promise<void> {
        const transaction = new DatabaseTransaction(this.database);
        await transaction.runBatchAsync(statements);
    }

    public async createConsumerState(consumerState: ConsumerState): Promise<void> {
        await this.database.run(
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

    public async getFirstConsumerState(): Promise<ConsumerState | undefined> {
        const consumerStateDBO = await this.database.get<ConsumerStateDBO>(
            `
            SELECT *
            FROM consumer_states
            ORDER BY stateChangeTimestamp ASC
            LIMIT 1;
        `,
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

    public async listConsumerStates(fromDate?: Date, toDate?: Date): Promise<ConsumerState[]> {
        const consumerStatesDBO = await this.database.all<ConsumerStateDBO[]>(
            `
            SELECT *
            FROM consumer_states
            WHERE stateChangeTimestamp >= $fromDate
            AND stateChangeTimestamp <= $toDate
            ORDER BY stateChangeTimestamp ASC;
        `,
            {
                $fromDate: fromDate?.getTime() ?? 0,
                $toDate: toDate?.getTime() ?? Date.now(),
            },
        );
        return consumerStatesDBO.map((consumerStateDBO) => ({
            consumerName: consumerStateDBO.consumerName,
            stateChangeDate: new Date(consumerStateDBO.stateChangeISO),
            state: consumerStateDBO.state,
        }));
    }

    public async getLatestConsumerStateBeforeTimestamp(
        consumerName: string,
        timestamp: number,
    ): Promise<ConsumerState | undefined> {
        const consumerStateDBO = await this.database.get<ConsumerStateDBO>(
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

    private async createConsumerStatesTable(): Promise<void> {
        await this.database.exec(`
            CREATE TABLE IF NOT EXISTS consumer_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                consumerName TEXT NOT NULL,
                stateChangeISO TEXT NOT NULL,
                stateChangeTimestamp INTEGER NOT NULL,
                state INTEGER NOT NULL
            ) ;
        `);
        await this.database.exec(`
            CREATE INDEX IF NOT EXISTS consumer_states_consumerName_stateChangeTimestamp
            ON consumer_states (consumerName, stateChangeTimestamp);
        `);
        await this.database.exec(`
            CREATE INDEX IF NOT EXISTS consumer_states_stateChangeTimestamp 
            ON consumer_states (stateChangeTimestamp);
        `);
    }
}
