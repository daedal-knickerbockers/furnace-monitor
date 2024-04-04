import log from "loglevel";
import { Config, ConfigLoader } from "./Config";
import { Consumer } from "./consumer/Consumer";
import { ConsumerRepository } from "./consumer/ConsumerRepository";
import { Database } from "./database/Database";
import { DatabaseFileExporter } from "./database/DatabaseFileExporter";
import { Args } from "./lib/Args";
import { Gpio } from "./lib/Gpio";
import { ResolSensor } from "./resol-sensor/ResolSensor";
import { ResolSensorRepository } from "./resol-sensor/ResolSensorRepository";

let shouldRun = true;
let databaseFileExporter: DatabaseFileExporter;

async function main(): Promise<void> {
    process.once("SIGINT", () => {
        log.info("Received SIGINT, exiting...");
        shouldRun = false;
    });

    const args = new Args(process.argv.slice(2));
    const configFilePath = args.get("--config") as string;
    const config = ConfigLoader.fromFile(configFilePath);
    const gpio = new Gpio(config.gpioBasePath);
    const database = new Database(config.database);

    log.setLevel(config.logLevel || "info");

    await database.init();

    const consumerRepository = new ConsumerRepository(database);
    await consumerRepository.init();

    const resolSensorRepository = new ResolSensorRepository(database);
    await resolSensorRepository.init();

    databaseFileExporter = new DatabaseFileExporter(config.database, consumerRepository, resolSensorRepository);
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
        await databaseFileExporter.destroy();
    });
