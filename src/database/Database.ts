import { Database as DB } from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";

function getBasePath(): string {
    if (process.env.DATABASE_BASE_PATH) {
        return process.env.DATABASE_BASE_PATH;
    } else {
        return path.join("/app", "data");
    }
}

const DATABASE_PATH = path.join(getBasePath(), "database.sqlite");

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
