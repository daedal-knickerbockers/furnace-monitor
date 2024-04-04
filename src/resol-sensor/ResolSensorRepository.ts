import { Database } from "../database/Database";
import { ResolSensorValue } from "./ResolSensor";

export type ResolSensorValueDBO = Omit<ResolSensorValue, "createdDate"> & {
    createdTimestamp: number;
    createdISO: string;
};

export class ResolSensorRepository {
    public constructor(private readonly database: Database) {
        //
    }

    public async init(): Promise<void> {
        await this.createResolSensorValuesTable();
    }

    public async createResolSensorValue(value: ResolSensorValue): Promise<void> {
        await this.database.run(
            `
            INSERT INTO resol_sensor_values (
                name,
                value,
                createdTimestamp,
                createdISO
            ) VALUES (
                $name,
                $value,
                $createdTimestamp,
                $createdISO
            );
        `,
            {
                $name: value.name,
                $value: value.value,
                $createdTimestamp: value.createdDate.getTime(),
                $createdISO: value.createdDate.toISOString(),
            },
        );
    }

    public async listResolSensorValues(fromDate?: Date, toDate?: Date): Promise<ResolSensorValue[]> {
        const resolSensorValuesDBO = await this.database.all<ResolSensorValueDBO[]>(
            `
            SELECT *
            FROM resol_sensor_values
            WHERE createdTimestamp >= $fromDate
            AND createdTimestamp <= $toDate
            ORDER BY createdTimestamp ASC;
        `,
            {
                $fromDate: fromDate?.getTime() ?? 0,
                $toDate: toDate?.getTime() ?? Date.now(),
            },
        );

        return resolSensorValuesDBO.map((dbo) => ({
            name: dbo.name,
            value: dbo.value,
            createdDate: new Date(dbo.createdISO),
        }));
    }

    private async createResolSensorValuesTable(): Promise<void> {
        await this.database.exec(`
            CREATE TABLE IF NOT EXISTS resol_sensor_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                value REAL NOT NULL,
                createdTimestamp INTEGER NOT NULL,
                createdISO TEXT NOT NULL
            );
        `);
        await this.database.exec(`
            CREATE INDEX IF NOT EXISTS resol_sensor_values_createdTimestamp
            ON resol_sensor_values (createdTimestamp);
        `);
    }
}
