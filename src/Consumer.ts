import { ConsumerConfig } from "./Config";
import { Gpio, PinState } from "./Gpio";
import { LocalRepository } from "./LocalRepository";

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

export class Consumer {
    public constructor(
        public readonly name: string,
        private readonly config: ConsumerConfig,
        private readonly repository: LocalRepository,
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
        await this.repository.createConsumerState(consumerState);

        if (state === PinState.LOW) {
            const previousState = await this.repository.getLatestConsumerStateBeforeTimestamp(
                this.name,
                stateChangeDate.getTime(),
            );
            if (previousState && previousState.state === PinState.HIGH) {
                const startedDate = previousState.stateChangeDate;
                const durationSeconds = (stateChangeDate.getTime() - startedDate.getTime()) / 1000;
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
