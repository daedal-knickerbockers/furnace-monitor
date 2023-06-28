import log from "loglevel";
import { Args } from "./Args";
import { ConfigLoader } from "./Config";
import { Consumer } from "./Consumer";
import { Gpio } from "./Gpio";
import { LocalRepository } from "./LocalRepository";
import { RemoteRepository } from "./RemoteRepository";

async function main(): Promise<void> {
    const args = new Args(process.argv.slice(2));
    const configFilePath = args.get("--config") as string;
    const config = ConfigLoader.fromFile(configFilePath);
    const gpio = new Gpio(config.gpioBasePath);

    log.setLevel(config.logLevel || "info");

    const localRepository = new LocalRepository(config.database.localDatabase);
    await localRepository.init();

    const remoteRepository = new RemoteRepository(config.database.remoteDatabase, config.localConfigDirPath);
    const remoteRepositoryConfig = await remoteRepository.init();
    log.info("Remote repository config", remoteRepositoryConfig);

    for (const [consumerName, consumerConfig] of Object.entries(config.consumers)) {
        const consumer = new Consumer(consumerName, consumerConfig, localRepository, gpio);
        await consumer.init();
    }
}

main().catch((error) => {
    log.error(error);
    process.exit(1);
});
