import { Database, open } from "sqlite";
import sqlite3 from "sqlite3";
import { PinState } from "./Gpio";

export interface ConsumerState {
    consumerName: string;
    stateChangeISO: string;
    stateChangeTimestamp: number;
    state: PinState;
    expiresISO?: string;
    expiresTimestamp?: number;
}

export interface ConsumerRuntime {
    consumerName: string;
    startedISO: string;
    startedTimestamp: number;
    stoppedISO: string;
    stoppedTimestamp: number;
    durationSeconds: number;
    isSavedRemotely: boolean;
    expiresISO?: string;
    expiresTimestamp?: number;
}

export class LocalRepository {
    private db: Database;

    public constructor(private readonly path: string) {
        //
    }

    public async init(): Promise<void> {
        this.db = await open({
            filename: this.path,
            driver: sqlite3.Database,
        });

        await this.createTables();
    }

    public async createConsumerState(consumerName: string, state: PinState, stateChangeDate: Date): Promise<void> {
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
                $consumerName: consumerName,
                $stateChangeISO: stateChangeDate.toISOString(),
                $stateChangeTimestamp: stateChangeDate.getTime(),
                $state: state,
            },
        );
    }

    public async getLatestConsumerStateInState(
        consumerName: string,
        state: PinState,
    ): Promise<ConsumerState | undefined> {
        return await this.db.get(
            `
            SELECT
                consumerName,
                stateChangeISO,
                stateChangeTimestamp,
                state
            FROM consumer_state
            WHERE consumerName = $consumerName
            AND state = $state
            ORDER BY stateChangeTimestamp DESC
            LIMIT 1;
        `,
            {
                $consumerName: consumerName,
                $state: state,
            },
        );
    }

    public async createConsumerRuntime(consumerName: string, started: Date, stopped: Date): Promise<void> {
        const durationSeconds = Math.round((stopped.getTime() - started.getTime()) / 1000);
        await this.db.run(
            `
            INSERT INTO consumer_runtime (
                consumerName,
                startedISO,
                startedTimestamp,
                stoppedISO,
                stoppedTimestamp,
                durationSeconds
            ) VALUES (
                $consumerName,
                $startedISO,
                $startedTimestamp,
                $stoppedISO,
                $stoppedTimestamp,
                $durationSeconds
            );
            `,
            {
                $consumerName: consumerName,
                $startedISO: started.toISOString(),
                $startedTimestamp: started.getTime(),
                $stoppedISO: stopped.toISOString(),
                $stoppedTimestamp: stopped.getTime(),
                $durationSeconds: durationSeconds,
            },
        );
    }

    private async createTables(): Promise<void> {
        await this.createConsumerStateTable();
        await this.createConsumerRuntimeTable();
    }

    private async createConsumerStateTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_state (
                id INTEGER PRIMARY KEY,
                consumerName TEXT NOT NULL,
                stateChangeISO TEXT NOT NULL,
                stateChangeTimestamp INTEGER NOT NULL,
                state INTEGER NOT NULL,
                expiresISO TEXT,
                expiresTimestamp INTEGER
            );
        `);
    }

    private async createConsumerRuntimeTable(): Promise<void> {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS consumer_runtime (
                id INTEGER PRIMARY KEY,
                consumerName TEXT NOT NULL,
                startedISO TEXT NOT NULL,
                startedTimestamp INTEGER NOT NULL,
                stoppedISO TEXT NOT NULL,
                stoppedTimestamp INTEGER NOT NULL,
                durationSeconds INTEGER NOT NULL,
                isSavedRemotely INTEGER DEFAULT 0,
                expiresISO TEXT,
                expiresTimestamp INTEGER
            );
        `);
    }
}
