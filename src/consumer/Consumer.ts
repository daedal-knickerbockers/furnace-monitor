/* eslint-disable @typescript-eslint/no-misused-promises */
import { ConsumerConfig } from "../Config";
import { Gpio, PinState } from "../lib/Gpio";
import { ConsumerRepository } from "./ConsumerRepository";

export interface ConsumerState {
    consumerName: string;
    stateChangeDate: Date;
    state: PinState;
}

export class Consumer {
    private midnightStateChangeInterval: NodeJS.Timeout;

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

        // Choose a date slightly after midnight, to prevent problems if the timeout triggers a bit too soon
        const millisToMidnight = new Date().setHours(24, 0, 30, 0) - Date.now();
        this.midnightStateChangeInterval = setTimeout(async () => {
            await this.logMidnightStateChange();
            this.midnightStateChangeInterval = setInterval(
                async () => {
                    await this.logMidnightStateChange();
                },
                24 * 60 * 60 * 1000,
            );
        }, millisToMidnight);
    }

    public async destroy(): Promise<void> {
        clearTimeout(this.midnightStateChangeInterval);
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

    private async logMidnightStateChange(): Promise<void> {
        const currentPinState = await this.gpio.read(this.config.gpio);

        const negatedPinState = currentPinState === PinState.HIGH ? PinState.LOW : PinState.HIGH;
        const negatedStateChangeDate = new Date();
        negatedStateChangeDate.setHours(0, 0, 0, 0);
        const negatedState: ConsumerState = {
            consumerName: this.name,
            stateChangeDate: negatedStateChangeDate,
            state: negatedPinState,
        };
        await this.repository.createConsumerState(negatedState);

        const stateChangeDate = new Date(negatedStateChangeDate.getTime() + 1);
        const currentState: ConsumerState = {
            consumerName: this.name,
            stateChangeDate,
            state: currentPinState,
        };
        await this.repository.createConsumerState(currentState);
    }
}
