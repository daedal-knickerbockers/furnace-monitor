import { clearAsyncInterval, setAsyncInterval } from "./AsyncInterval";
import { ConsumerRuntimeKeys, LocalRepository } from "./LocalRepository";
import { RemoteRepository } from "./RemoteRepository";

export class RemoteDataPersister {
    private intervalId: number;

    public constructor(private localRepository: LocalRepository, private remoteRepository: RemoteRepository) {
        //
    }

    public init(): void {
        if (!this.intervalId) {
            this.intervalId = setAsyncInterval(this.persistData.bind(this), 1000);
        }
    }

    public destroy(): void {
        if (this.intervalId) {
            clearAsyncInterval(this.intervalId);
        }
    }

    public async persistData(): Promise<void> {
        const unsavedConsumerRuntimes = await this.localRepository.getConsumerRuntimes({
            isSavedRemotely: false,
        });
        if (unsavedConsumerRuntimes.length > 0) {
            await this.remoteRepository.writeConsumerRuntimes(unsavedConsumerRuntimes);
            const unsavedConsumerRuntimeKeys: ConsumerRuntimeKeys = unsavedConsumerRuntimes.map((consumerRuntime) => ({
                consumerName: consumerRuntime.consumerName,
                startedTimestamp: consumerRuntime.startedDate.getTime(),
            }));
            await this.localRepository.markConsumerRuntimesSavedRemotely(unsavedConsumerRuntimeKeys);
        }
    }
}
