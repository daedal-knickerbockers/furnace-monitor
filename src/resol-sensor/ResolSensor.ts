import log from "loglevel";
import { Specification, TcpConnection } from "resol-vbus";
import { ResolSensorConfig } from "../Config";
import { ResolSensorRepository } from "./ResolSensorRepository";

export type ResolSensorValue = {
    name: string;
    values: Record<string, number>;
    createdDate: Date;
};

type CollectedValue = {
    name: string;
    value: number;
};

type CollectedValues = Array<CollectedValue>;

export class ResolSensor {
    private readonly connection: TcpConnection;
    private readonly specification: Specification;

    private collectedValuesBuffer: CollectedValues[] = [];
    private bufferingTimeout: NodeJS.Timeout;

    public constructor(
        private readonly name: string,
        private readonly config: ResolSensorConfig,
        private readonly repository: ResolSensorRepository,
    ) {
        this.connection = new TcpConnection({
            host: this.config.host,
            password: this.config.password,
        });

        this.specification = Specification.getDefaultSpecification();

        this.bufferingTimeout = setTimeout(
            this.handleBufferingTimeout.bind(this),
            this.config.valueCollectionTimeSeconds * 1000,
        );
    }

    public async init(): Promise<void> {
        try {
            await this.connection.connect();
            this.connection.on("packet", this.onPacket.bind(this));
        } catch (error) {
            log.error(`Failed to connect to ${this.config.host}: ${(error as Error).message}`);
            return;
        }
    }

    public async destroy(): Promise<void> {
        this.connection.disconnect();
        clearTimeout(this.bufferingTimeout);
    }

    private async onPacket(packet: Buffer): Promise<void> {
        const packetFields = this.specification.getPacketFieldsForHeaders([packet]);
        const collectedValues: CollectedValues = [];
        for (const packetField of packetFields) {
            const collectedValue: CollectedValue = {
                name: packetField.name,
                value: packetField.rawValue,
            };
            collectedValues.push(collectedValue);
        }
        this.collectedValuesBuffer.push(collectedValues);
    }

    private async handleBufferingTimeout(): Promise<void> {
        try {
            const collectedValues = this.collectBufferedValues();
            await this.storeCollectedValues(collectedValues);
        } catch (error) {
            log.error(`Failed to store collected values: ${(error as Error).message}`);
            // Remove 1/3 of the collected values buffer to prevent memory leaks
            this.collectedValuesBuffer.splice(0, Math.floor(this.collectedValuesBuffer.length / 3));
        }

        this.bufferingTimeout = setTimeout(
            this.handleBufferingTimeout.bind(this),
            this.config.valueCollectionTimeSeconds * 1000,
        );
    }

    /**
     * Clear the collected values buffer and calculate the average value for each collected value.
     * Values are rounded to two decimal places.
     */
    private collectBufferedValues(): CollectedValues {
        const valuesByName: Record<string, number[]> = {};
        for (const bufferedValues of this.collectedValuesBuffer.splice(0, this.collectedValuesBuffer.length)) {
            for (const collectedValue of bufferedValues) {
                valuesByName[collectedValue.name] = valuesByName[collectedValue.name] || [];
                valuesByName[collectedValue.name].push(collectedValue.value);
            }
        }

        const collectedValues: CollectedValues = [];
        for (const [name, values] of Object.entries(valuesByName)) {
            const sum = values.reduce((sum, value) => sum + value, 0);
            const avg = sum / values.length;
            const value = Math.round(avg * 100) / 100;
            collectedValues.push({ name, value });
        }

        return collectedValues;
    }

    private async storeCollectedValues(collectedValues: CollectedValues): Promise<void> {
        const resolSensorValue: ResolSensorValue = {
            name: this.name,
            createdDate: new Date(),
            values: collectedValues.reduce(
                (values, collectedValue) => {
                    values[collectedValue.name] = collectedValue.value;
                    return values;
                },
                {} as Record<string, number>,
            ),
        };

        await this.repository.createResolSensorValue(resolSensorValue);
    }
}
