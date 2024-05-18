import log from "loglevel";
import { Config, ConfigLoader } from "./Config";
import { Consumer } from "./consumer/Consumer";
import { ConsumerRepository } from "./consumer/ConsumerRepository";
import { Database } from "./database/Database";
import { DatabaseFileExporter } from "./database/DatabaseFileExporter";
import { Gpio } from "./lib/Gpio";
import { ResolSensor } from "./resol-sensor/ResolSensor";
import { ResolSensorRepository } from "./resol-sensor/ResolSensorRepository";

let shouldRun = true;
let databaseFileExporter: DatabaseFileExporter;
let gpio: Gpio;

async function main(): Promise<void> {
    process.once("SIGINT", () => {
        log.info("Received SIGINT, exiting...");
        shouldRun = false;
    });

    const config = ConfigLoader.get();
    gpio = new Gpio();
    const database = new Database();

    log.setLevel(config.logLevel || "info");

    await database.init();

    const consumerRepository = new ConsumerRepository(database);
    await consumerRepository.init();

    const resolSensorRepository = new ResolSensorRepository(database);
    await resolSensorRepository.init();

    databaseFileExporter = new DatabaseFileExporter(config.fileExport, consumerRepository, resolSensorRepository);
    await databaseFileExporter.init();

    await initializeConsumers(config, consumerRepository, gpio);

    await initializeResolSensors(config, resolSensorRepository);

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
        log.info(`Registered consumer: ${consumerName}`);
    }
}

async function initializeResolSensors(config: Readonly<Config>, repository: ResolSensorRepository): Promise<void> {
    if (!config.resolSensors) {
        return;
    }

    for (const [resolSensorName, resolSensorConfig] of Object.entries(config.resolSensors)) {
        const resolSensor = new ResolSensor(resolSensorConfig, repository);
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
    .finally(async () => {
        gpio.stopWatchingAll();
        await databaseFileExporter.destroy();
    });
