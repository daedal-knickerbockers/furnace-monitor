import log from "loglevel";
import { Args } from "./Args";
import { ConfigLoader } from "./Config";
import { Consumer } from "./Consumer";
import { Gpio } from "./Gpio";
import { LocalRepository } from "./LocalRepository";
import { RuntimeAggregator } from "./RuntimeAggregator";

let shouldRun = true;
let runtimeAggregator: RuntimeAggregator | undefined;

async function main(): Promise<void> {
    process.once("SIGINT", () => {
        log.info("Received SIGINT, exiting...");
        shouldRun = false;
    });

    const args = new Args(process.argv.slice(2));
    const configFilePath = args.get("--config") as string;
    const config = ConfigLoader.fromFile(configFilePath);
    const gpio = new Gpio(config.gpioBasePath);

    log.setLevel(config.logLevel || "info");

    const localRepository = new LocalRepository(config.database.localDatabase);
    await localRepository.init();

    runtimeAggregator = new RuntimeAggregator(localRepository);

    for (const [consumerName, consumerConfig] of Object.entries(config.consumers)) {
        const consumer = new Consumer(consumerName, consumerConfig, localRepository, gpio);
        await consumer.init();
        runtimeAggregator.registerConsumer(consumerName);
        log.info(`Registered consumer: ${consumerName}`);
    }

    while (shouldRun) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

main()
    .then(() => {
        log.info("Exiting...");
        process.exit(0);
    })
    .catch((error) => {
        log.error(error);
        process.exit(1);
    })
    .finally(() => {
        runtimeAggregator?.destroy();
    });
