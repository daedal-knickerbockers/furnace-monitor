import { ConsumerConfig } from "../Config";
import { Gpio, PinState } from "../Gpio";
import { ConsumerRepository } from "./ConsumerRepository";

export interface ConsumerState {
    consumerName: string;
    stateChangeDate: Date;
    state: PinState;
}

export interface ConsumerRuntime {
    consumerName: string;
    startedDate: Date;
    stoppedDate: Date;
    durationSeconds: number;
}

export type AggregationInterval = "hourly" | "daily" | "weekly" | "monthly" | "yearly";

export interface ConsumerRuntimeAggregate {
    consumerName: string;
    startedDate: Date;
    durationSeconds: number;
    interval: AggregationInterval;
}

export class Consumer {
    public constructor(
        public readonly name: string,
        private readonly config: ConsumerConfig,
        private readonly repository: ConsumerRepository,
        private readonly gpio: Gpio,
    ) {
        //
    }

    public async init(): Promise<void> {
        await this.gpio.watch(this.config.gpio, this.handleStateChange.bind(this));
    }

    public async handleStateChange(state: PinState): Promise<void> {
        const stateChangeDate = new Date();
        const consumerState: ConsumerState = {
            consumerName: this.name,
            stateChangeDate,
            state,
        };
        const previousState = await this.repository.getLatestConsumerStateBeforeTimestamp(
            this.name,
            stateChangeDate.getTime(),
        );
        if (previousState && previousState.state === state) {
            // Do not persist identical state changes - this might happen when the gpio file is manually modified
            return;
        }
        await this.repository.createConsumerState(consumerState);

        if (state === PinState.LOW) {
            if (previousState && previousState.state === PinState.HIGH) {
                const startedDate = previousState.stateChangeDate;
                const durationSeconds = Math.round((stateChangeDate.getTime() - startedDate.getTime()) / 1000);
                const consumerRuntime: ConsumerRuntime = {
                    consumerName: this.name,
                    startedDate,
                    stoppedDate: stateChangeDate,
                    durationSeconds,
                };
                await this.repository.createConsumerRuntime(consumerRuntime);
            }
        }
    }
}
