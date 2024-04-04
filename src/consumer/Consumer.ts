import { ConsumerConfig } from "../Config";
import { Gpio, PinState } from "../lib/Gpio";
import { ConsumerRepository } from "./ConsumerRepository";

export interface ConsumerState {
    consumerName: string;
    stateChangeDate: Date;
    state: PinState;
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
    }
}
