import { ConsumerConfig } from "./Config";
import { Gpio, PinState } from "./Gpio";
import { LocalRepository } from "./LocalRepository";

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
        await this.repository.createConsumerState(this.name, state, stateChangeDate);

        if (state === PinState.LOW) {
            const lastHighState = await this.repository.getLatestConsumerStateInState(this.name, PinState.HIGH);
            if (lastHighState) {
                const startedDate = new Date(lastHighState.stateChangeISO);
                await this.repository.createConsumerRuntime(this.name, startedDate, stateChangeDate);
            }
        }
    }
}
