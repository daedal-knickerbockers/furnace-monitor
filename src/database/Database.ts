import { Database as DB } from "sqlite";
import sqlite3 from "sqlite3";
import { DatabaseConfig } from "../Config";

export class Database extends DB {
    public constructor(config: DatabaseConfig) {
        super({
            filename: config.path,
            driver: sqlite3.Database,
        });
    }

    public async init(): Promise<void> {
        await this.open();
    }
}
