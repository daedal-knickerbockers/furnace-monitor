import Ajv, { ErrorObject, JSONSchemaType } from "ajv";
import fs from "fs";

export interface ConsumerConfig {
    gpio: number;
}

export interface DatabaseConfig {
    localDatabase: {
        filePath: string;
    };
    remoteDatabase: {
        keyPath: string;
    };
}

export type Config = {
    localConfigDirPath: string;
    gpioBasePath?: string;
    consumers: Record<string, ConsumerConfig>;
    database: DatabaseConfig;
};

const ConsumerConfigSchema: JSONSchemaType<ConsumerConfig> = {
    type: "object",
    properties: {
        gpio: { type: "number" },
    },
    required: ["gpio"],
    additionalProperties: false,
} as const;

const DatabaseConfigSchema: JSONSchemaType<DatabaseConfig> = {
    type: "object",
    properties: {
        localDatabase: {
            type: "object",
            properties: {
                filePath: { type: "string" },
            },
            required: ["filePath"],
            additionalProperties: false,
        },
        remoteDatabase: {
            type: "object",
            properties: {
                keyPath: { type: "string" },
            },
            required: ["keyPath"],
            additionalProperties: false,
        },
    },
    required: ["localDatabase", "remoteDatabase"],
    additionalProperties: false,
} as const;

const ConfigSchema = {
    type: "object",
    properties: {
        localConfigDirPath: { type: "string" },
        gpioBasePath: { type: "string" },
        consumers: {
            type: "object",
            additionalProperties: ConsumerConfigSchema,
        },
        database: DatabaseConfigSchema,
    },
    required: ["localConfigDirPath", "consumers", "database"],
    additionalProperties: false,
} as const;

const validateConfig = new Ajv({
    allErrors: true,
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
