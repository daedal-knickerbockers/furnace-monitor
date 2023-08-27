import { Statement } from "sqlite";
import { clearAsyncInterval, setAsyncInterval } from "../asyncInterval";
import { AggregationInterval, ConsumerRuntime, ConsumerRuntimeAggregate } from "./Consumer";
import { ConsumerRepository } from "./ConsumerRepository";

export class InvalidAggregationIntervalError extends Error {
    public constructor(interval: AggregationInterval) {
        super(`Invalid aggregation interval: ${interval}`);
    }
}

export class RuntimeAggregator {
    private static INTERVAL_SECONDS: Record<AggregationInterval, number> = {
        hourly: 60 * 60,
        daily: 60 * 60 * 24,
        weekly: 60 * 60 * 24 * 7,
        monthly: 60 * 60 * 24 * 30,
        yearly: 60 * 60 * 24 * 365,
    };

    public readonly consumerNames: Set<string>;
    private readonly aggregateRuntimesHandle: number;

    public constructor(private readonly repository: ConsumerRepository) {
        this.consumerNames = new Set();
        this.aggregateRuntimesHandle = setAsyncInterval(
            this.aggregateRuntimes.bind(this),
            1000 * 60, // Every Minute
        );
    }

    public registerConsumer(consumerName: string): void {
        this.consumerNames.add(consumerName);
    }

    public destroy(): void {
        clearAsyncInterval(this.aggregateRuntimesHandle);
    }

    private async aggregateRuntimes(): Promise<void> {
        const limit = 100;
        for (const consumerName of this.consumerNames) {
            await this.aggregateRuntime(consumerName, "hourly", limit);
            /*
            await this.aggregateRuntime(consumerName, "daily", limit);
            await this.aggregateRuntime(consumerName, "weekly", limit);
            await this.aggregateRuntime(consumerName, "monthly", limit);
            await this.aggregateRuntime(consumerName, "yearly", limit);
            */
        }
    }

    private async aggregateRuntime(consumerName: string, interval: AggregationInterval, limit: number): Promise<void> {
        try {
            const consumerRuntimes = await this.fetchUnaggregatedRuntimesForConsumer(consumerName, limit);
            const aggregates = await this.aggregateRuntimesByInterval(consumerRuntimes, interval);
            await this.persistAggregates(aggregates, consumerRuntimes);
        } catch (error) {
            //
        }
    }

    private async fetchUnaggregatedRuntimesForConsumer(consumerName: string, limit: number) {
        return await this.repository.getConsumerRuntimes(
            {
                consumerName,
                isAggregated: false,
            },
            limit,
        );
    }

    private async aggregateRuntimesByInterval(
        runtimes: ConsumerRuntime[],
        interval: AggregationInterval,
    ): Promise<ConsumerRuntimeAggregate[]> {
        const aggregatesByISOString: { [key: string]: ConsumerRuntimeAggregate } = {};
        const splitRuntimes = this.splitRuntimesByInterval(runtimes, interval);
        for (const runtime of splitRuntimes) {
            const intervalStart = this.getLastIntervalStart(interval, runtime.startedDate);
            const existingAggregate = aggregatesByISOString[intervalStart.toISOString()];
            if (existingAggregate) {
                existingAggregate.durationSeconds += runtime.durationSeconds;
            } else {
                const aggregateFromDatabase = await this.repository.getConsumerRuntimeAggregate(
                    runtime.consumerName,
                    intervalStart,
                    interval,
                );
                if (aggregateFromDatabase) {
                    aggregatesByISOString[intervalStart.toISOString()] = {
                        ...aggregateFromDatabase,
                        durationSeconds: aggregateFromDatabase.durationSeconds + runtime.durationSeconds,
                    };
                } else {
                    aggregatesByISOString[intervalStart.toISOString()] = {
                        consumerName: runtime.consumerName,
                        interval,
                        startedDate: intervalStart,
                        durationSeconds: runtime.durationSeconds,
                    };
                }
            }
        }
        return Object.values(aggregatesByISOString);
    }

    private splitRuntimesByInterval(runtimes: ConsumerRuntime[], interval: AggregationInterval): ConsumerRuntime[] {
        const separatedRuntimes: ConsumerRuntime[] = [];
        for (const runtime of runtimes) {
            const numberOfIntervals = Math.ceil(runtime.durationSeconds / RuntimeAggregator.INTERVAL_SECONDS[interval]);
            for (let i = 0; i < numberOfIntervals; i++) {
                const intervalStart = new Date(
                    runtime.startedDate.getTime() + i * RuntimeAggregator.INTERVAL_SECONDS[interval] * 1000,
                );
                const intervalEnd = new Date(
                    runtime.startedDate.getTime() + (i + 1) * RuntimeAggregator.INTERVAL_SECONDS[interval] * 1000,
                );
                const intervalDurationSeconds =
                    intervalEnd.getTime() > runtime.stoppedDate.getTime()
                        ? Math.round((runtime.stoppedDate.getTime() - intervalStart.getTime()) / 1000)
                        : RuntimeAggregator.INTERVAL_SECONDS[interval];
                const intervalRuntime: ConsumerRuntime = {
                    consumerName: runtime.consumerName,
                    startedDate: intervalStart,
                    stoppedDate: intervalEnd,
                    durationSeconds: intervalDurationSeconds,
                };
                separatedRuntimes.push(intervalRuntime);
            }
        }
        return separatedRuntimes;
    }

    private getLastIntervalStart(interval: AggregationInterval, date: Date): Date {
        switch (interval) {
            case "hourly":
                return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours());
            case "daily":
                return new Date(date.getFullYear(), date.getMonth(), date.getDate());
            case "weekly":
                return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
            case "monthly":
                return new Date(date.getFullYear(), date.getMonth());
            case "yearly":
                return new Date(date.getFullYear());
            default:
                throw new InvalidAggregationIntervalError(interval);
        }
    }

    private async persistAggregates(
        aggregates: ConsumerRuntimeAggregate[],
        runtimes: ConsumerRuntime[],
    ): Promise<void> {
        const statementsToExecute: Statement[] = [];
        for (const aggregate of aggregates) {
            const upsertStatement = await this.repository.createUpsertConsumerRuntimeAggregateStatement(aggregate);
            statementsToExecute.push(upsertStatement);
        }

        for (const runtime of runtimes) {
            const patchStatement = await this.repository.createPatchCustomerRuntimeStatement({
                data: {
                    isAggregated: true,
                },
                key: {
                    consumerName: runtime.consumerName,
                    startedTimestamp: runtime.startedDate.getTime(),
                },
            });
            statementsToExecute.push(patchStatement);
        }

        await this.repository.runMany(statementsToExecute);
    }
}
