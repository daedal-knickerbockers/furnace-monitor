import { Database as DB } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";

const DATABASE_PATH = path.join("/var", "data", "database.sqlite");

export class Database extends DB {
    public constructor() {
        super({
            filename: DATABASE_PATH,
            driver: sqlite3.Database,
        });
    }

    public async init(): Promise<void> {
        await this.open();
    }
}
