import log from "loglevel";
import { Args } from "./Args";
import { Config, ConfigLoader } from "./Config";
import { Gpio } from "./Gpio";
import { Consumer } from "./consumer/Consumer";
import { ConsumerRepository } from "./consumer/ConsumerRepository";
import { RuntimeAggregator } from "./consumer/RuntimeAggregator";
import { ResolSensor } from "./resol-sensor/ResolSensor";

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

    const consumerRepository = new ConsumerRepository(config.database.localDatabase);
    await consumerRepository.init();

    runtimeAggregator = new RuntimeAggregator(consumerRepository);

    await initializeConsumers(config, consumerRepository, gpio);

    await initializeResolSensors(config);

    while (shouldRun) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}

async function initializeConsumers(
    config: Readonly<Config>,
    consumerRepository: ConsumerRepository,
    gpio: Gpio,
): Promise<void> {
    for (const [consumerName, consumerConfig] of Object.entries(config.consumers)) {
        const consumer = new Consumer(consumerName, consumerConfig, consumerRepository, gpio);
        await consumer.init();
        runtimeAggregator!.registerConsumer(consumerName);
        log.info(`Registered consumer: ${consumerName}`);
    }
}

async function initializeResolSensors(config: Readonly<Config>): Promise<void> {
    for (const [resolSensorName, resolSensorConfig] of Object.entries(config.resolSensors)) {
        const resolSensor = new ResolSensor(resolSensorConfig);
        await resolSensor.init();
        log.info(`Registered resol sensor: ${resolSensorName}`);
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
