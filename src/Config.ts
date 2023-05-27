import Ajv, { JSONSchemaType } from "ajv";
import fs from "fs";

export type PinConfig = {
    name: string;
};

export type Config = {
    basePath: string;
    pinsToWatch: Record<number, PinConfig>;
};

const PinConfigSchema: JSONSchemaType<PinConfig> = {
    type: "object",
    properties: {
        name: { type: "string" },
    },
    required: ["name"],
    additionalProperties: false,
} as const;

const ConfigSchema = {
    type: "object",
    properties: {
        basePath: { type: "string" },
        pinsToWatch: {
            type: "object",
            patternProperties: {
                "^[0-9]+$": PinConfigSchema,
            },
            additionalProperties: false,
        },
    },
    required: ["pinsToWatch"],
    additionalProperties: false,
} as const;

const validateConfig = new Ajv({
    allErrors: true,
}).compile<Config>(ConfigSchema);

export class ConfigLoader {
    public static fromFile(filePath: string): Readonly<Config> {
        const file = fs.readFileSync(filePath, "utf-8");
        const parsedContent: unknown = JSON.parse(file);
        if (!validateConfig(parsedContent)) {
            const validationErrors = validateConfig.errors?.map((e) => e.message) ?? [];
            throw new Error(`Invalid config file: ${validationErrors.join(", ")}`);
        }
        return Object.freeze(parsedContent);
    }
}
