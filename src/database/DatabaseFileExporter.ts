import fs from "fs/promises";
import path from "path";
import { FileExportConfig } from "../Config";
import { ConsumerRepository } from "../consumer/ConsumerRepository";
import { clearAsyncInterval, setAsyncInterval } from "../lib/asyncInterval";
import { ResolSensorRepository } from "../resol-sensor/ResolSensorRepository";
import log from "loglevel";

function getBasePath(): string {
    if (process.env.FILE_EXPORT_BASE_PATH) {
        return process.env.FILE_EXPORT_BASE_PATH;
    } else {
        return path.join("/app", "data");
    }
}

const FILE_EXPORT_PATH = path.join(getBasePath(), "exports");

export type FileExporterStatus = {
    lastExportISO: string;
};

export class DatabaseFileExporter {
    private exportIntervalIndex: number;
    private readonly statusFilePath: string;

    public constructor(
        private readonly config: FileExportConfig,
        private readonly consumerRepository: ConsumerRepository,
        private readonly resolSensorRepository: ResolSensorRepository,
    ) {
        this.statusFilePath = path.join(FILE_EXPORT_PATH, ".status");
    }

    public async init(): Promise<void> {
        this.exportIntervalIndex = setAsyncInterval(async () => {
            await this.exportFiles();
        }, 60_000);
        await fs.mkdir(FILE_EXPORT_PATH, { recursive: true });
    }

    public async destroy(): Promise<void> {
        clearAsyncInterval(this.exportIntervalIndex);
    }

    private async exportFiles(): Promise<void> {
        const status = await this.getStatus();
        const nextExportDate = this.getNextDateForInterval(status?.lastExportISO);
        if (nextExportDate > new Date()) {
            return;
        }
        const fromDate: Date | undefined = status?.lastExportISO ? new Date(status.lastExportISO) : undefined;

        const promises = [
            this.exportConsumerStates(fromDate, nextExportDate),
            // this.exportResolSensorValues(fromDate, nextExportDate),
        ];
        const results = await Promise.allSettled(promises);
        if (results.some((result) => result.status === "rejected")) {
            log.error("Failed to export files");
        } else {
            await this.setStatus({
                lastExportISO: nextExportDate.toISOString(),
            });
        }
    }

    private async getStatus(): Promise<FileExporterStatus | undefined> {
        try {
            const file = await fs.readFile(this.statusFilePath, "utf8");
            if (file) {
                return JSON.parse(file) as FileExporterStatus;
            }
        } catch (error) {
            if ((error as any).code !== "ENOENT") {
                log.error("Failed to read status file", error);
                throw error;
            }
        }
        return undefined;
    }

    private async setStatus(status: FileExporterStatus): Promise<void> {
        await fs.writeFile(this.statusFilePath, JSON.stringify(status), "utf8");
    }

    private getNextDateForInterval(startDateISO?: string): Date {
        if (!startDateISO) {
            return new Date();
        }

        let nextDateMillis = new Date(startDateISO).valueOf();
        switch (this.config.interval) {
            case "HOURLY":
                nextDateMillis += 60 * 60 * 1000;
                break;
            case "DAILY":
                nextDateMillis += 24 * 60 * 60 * 1000;
                break;
            case "WEEKLY":
                nextDateMillis += 7 * 24 * 60 * 60 * 1000;
                break;
            case "MONTHLY":
                nextDateMillis += 30 * 24 * 60 * 60 * 1000;
                break;
        }
        return new Date(nextDateMillis);
    }

    private async exportConsumerStates(fromDate: Date | undefined, toDate: Date): Promise<void> {
        if (!fromDate) {
            const firstConsumerState = await this.consumerRepository.getFirstConsumerState();
            if (!firstConsumerState) {
                return;
            }
            fromDate = firstConsumerState.stateChangeDate;
        }

        const nextEndDate = this.getNextDateForInterval(fromDate.toISOString());
        if (nextEndDate > toDate) {
            return;
        }
        const consumerStates = await this.consumerRepository.listConsumerStates(fromDate, nextEndDate);
        if (consumerStates.length > 0) {
            const csv = consumerStates
                .map((consumerState) => {
                    return `${consumerState.consumerName},${consumerState.stateChangeDate.toISOString()},${
                        consumerState.state
                    }`;
                })
                .join("\n");
            const exportPath = path.join(
                FILE_EXPORT_PATH,
                `consumer_states_${fromDate.toISOString()}_${this.config.interval}.csv`,
            );
            await fs.writeFile(exportPath, csv, "utf8");
        }
        return this.exportConsumerStates(nextEndDate, toDate);
    }

    private async exportResolSensorValues(fromDate: Date = new Date(0), toDate: Date): Promise<void> {
        const nextEndDate = this.getNextDateForInterval(fromDate.toISOString());
        if (nextEndDate > toDate) {
            return;
        }
        const resolSensorValues = await this.resolSensorRepository.listResolSensorValues(fromDate, nextEndDate);
        if (resolSensorValues.length > 0) {
            const csv = resolSensorValues
                .map((resolSensorValue) => {
                    return `${resolSensorValue.name},${
                        resolSensorValue.value
                    },${resolSensorValue.createdDate.toISOString()}`;
                })
                .join("\n");
            const exportPath = path.join(
                FILE_EXPORT_PATH,
                `resol_sensor_values_${fromDate.toISOString()}_${this.config.interval}.csv`,
            );
            await fs.writeFile(exportPath, csv, "utf8");
        }
        return this.exportResolSensorValues(nextEndDate, toDate);
    }
}
