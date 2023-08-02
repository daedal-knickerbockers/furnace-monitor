import fs from "fs";
import log from "loglevel";
import path from "path";
import { Args } from "../src/Args";
import { ConfigLoader } from "../src/Config";

let shouldRun = true;

const args = new Args(process.argv.slice(2));
const configFilePath = args.get("--config") as string;
const config = ConfigLoader.fromFile(configFilePath);
log.setLevel(config.logLevel || "info");
const basePath = config.gpioBasePath ?? path.join(__dirname, "..", "gpio");

process.once("SIGINT", () => {
    console.log("Received SIGINT, exiting...");
    shouldRun = false;
});

function setupGpio(): void {
    const exportFilePath = path.join(basePath, "export");
    if (!fs.existsSync(exportFilePath)) {
        fs.writeFileSync(exportFilePath, "");
    }
    const unexportFilePath = path.join(basePath, "unexport");
    if (!fs.existsSync(unexportFilePath)) {
        fs.writeFileSync(unexportFilePath, "");
    }

    for (const consumer of Object.values(config.consumers)) {
        const pin = consumer.gpio;
        const pinPath = path.join(basePath, `gpio${pin}`);
        if (!fs.existsSync(pinPath)) {
            fs.mkdirSync(pinPath);
        }
        const directionFilePath = path.join(pinPath, "direction");
        if (!fs.existsSync(directionFilePath)) {
            fs.writeFileSync(directionFilePath, "");
        }
        const valueFilePath = path.join(pinPath, "value");
        if (!fs.existsSync(valueFilePath)) {
            fs.writeFileSync(valueFilePath, "");
        }
        log.info(`Setup GPIO pin ${pin}`);
    }
}

async function simulateGpio(): Promise<void> {
    return new Promise((resolve, reject) => {
        const consumerIdIndex = Math.floor(Math.random() * Object.keys(config.consumers).length);
        const consumerId = Object.keys(config.consumers)[consumerIdIndex];
        const consumer = config.consumers[consumerId];
        const pin = consumer.gpio;
        const pinPath = path.join(basePath, `gpio${pin}`);
        const value = Math.random() > 0.5 ? "1" : "0";
        fs.writeFileSync(path.join(pinPath, "value"), value);
        log.info(`Simulated GPIO pin ${pin} with value ${value}`);

        if (shouldRun) {
            const timeoutMillis = Math.random() * 1000 * 60 * 5; // Max 5 minutes
            setTimeout(() => {
                simulateGpio().catch((error) => reject(error));
            }, timeoutMillis);
        } else {
            resolve();
        }
    });
}

setupGpio();
simulateGpio().catch((error) => {
    log.error("Error while simulating gpio: ", error);
    process.exit(1);
});
