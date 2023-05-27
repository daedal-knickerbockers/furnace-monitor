import { Args } from "./Args";
import { ConfigLoader } from "./Config";
import { Gpio } from "./Gpio";

async function main(): Promise<void> {
    const args = new Args(process.argv.slice(2));
    const configFilePath = args.get("--config") as string;
    const config = ConfigLoader.fromFile(configFilePath);
    const gpio = new Gpio(config.basePath);

    for (const [gpioPin, pinConfig] of Object.entries(config.pinsToWatch)) {
        console.log(`Watching gpio ${gpioPin} with name ${pinConfig.name}`);
        await gpio.watch(parseInt(gpioPin), (pinState) => {
            console.log(`Pin ${pinConfig.name} changed to ${pinState}`);
            return Promise.resolve();
        });
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
