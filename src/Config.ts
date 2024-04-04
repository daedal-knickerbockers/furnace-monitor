import { ErrorObject } from "ajv";
import Ajv, { JTDSchemaType } from "ajv/dist/jtd";
import fs from "fs";
import { LogLevelNames } from "loglevel";

export interface ConsumerConfig {
    gpio: number;
}

export interface ResolSensorConfig {
    host: string;
    password: string;
}

export interface DatabaseConfig {
    path: string;
    fileExport: {
        exportDirectory: string;
        interval: "DAILY" | "WEEKLY" | "MONTHLY" | "HOURLY";
    };
}

export interface Config {
    /** Defaults to "info" */
    logLevel?: LogLevelNames;
    localConfigDirPath: string;
    gpioBasePath?: string;
    consumers: Record<string, ConsumerConfig>;
    resolSensors?: Record<string, ResolSensorConfig>;
    database: DatabaseConfig;
}

const ConsumerConfigSchema: JTDSchemaType<ConsumerConfig> = {
    properties: {
        gpio: { type: "uint8" },
    },
};

const ResolSensorConfigSchema: JTDSchemaType<ResolSensorConfig> = {
    properties: {
        host: { type: "string" },
        password: { type: "string" },
    },
};

const DatabaseConfigSchema: JTDSchemaType<DatabaseConfig> = {
    properties: {
        path: { type: "string" },
        fileExport: {
            properties: {
                exportDirectory: { type: "string" },
                interval: { enum: ["DAILY", "WEEKLY", "MONTHLY", "HOURLY"] },
            },
        },
    },
};

const ConfigSchema: JTDSchemaType<Config> = {
    properties: {
        localConfigDirPath: { type: "string" },
        consumers: {
            values: ConsumerConfigSchema,
        },
        database: DatabaseConfigSchema,
    },
    optionalProperties: {
        logLevel: { enum: ["trace", "debug", "info", "warn", "error"] },
        gpioBasePath: { type: "string" },
        resolSensors: {
            values: ResolSensorConfigSchema,
        },
    },
};

const validateConfig = new Ajv({
    allErrors: true,
    jtd: true,
}).compile<Config>(ConfigSchema);

export class InvalidConfigError extends Error {
    public constructor(public readonly validationErrors: ErrorObject[]) {
        super(`Invalid config`);
    }
}

export class ConfigLoader {
    public static fromFile(filePath: string): Readonly<Config> {
        const file = fs.readFileSync(filePath, "utf-8");
        const parsedContent: unknown = JSON.parse(file);
        if (!validateConfig(parsedContent)) {
            const validationErrors = validateConfig.errors ?? [];
            throw new InvalidConfigError(validationErrors);
        }
        return Object.freeze(parsedContent);
    }
}
