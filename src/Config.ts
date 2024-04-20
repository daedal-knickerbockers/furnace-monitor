import { ErrorObject } from "ajv";
import Ajv, { JTDSchemaType } from "ajv/dist/jtd";
import fs from "fs";
import { LogLevelNames } from "loglevel";
import path from "path";

export interface ConsumerConfig {
    gpio: number;
}

export interface ResolSensorConfig {
    host: string;
    password: string;
}

export interface FileExportConfig {
    interval: "DAILY" | "WEEKLY" | "MONTHLY" | "HOURLY";
}

export interface Config {
    /** Defaults to "info" */
    logLevel?: LogLevelNames;
    consumers: Record<string, ConsumerConfig>;
    resolSensors?: Record<string, ResolSensorConfig>;
    fileExport: FileExportConfig;
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

const FileExportConfigSchema: JTDSchemaType<FileExportConfig> = {
    properties: {
        interval: { enum: ["DAILY", "WEEKLY", "MONTHLY", "HOURLY"] },
    },
};

const ConfigSchema: JTDSchemaType<Config> = {
    properties: {
        consumers: {
            values: ConsumerConfigSchema,
        },
        fileExport: FileExportConfigSchema,
    },
    optionalProperties: {
        logLevel: { enum: ["trace", "debug", "info", "warn", "error"] },
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

const CONFIG_FILE_PATH = path.join("/var", "config", "config.json");

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

    public static get(): Readonly<Config> {
        return this.fromFile(CONFIG_FILE_PATH);
    }
}
