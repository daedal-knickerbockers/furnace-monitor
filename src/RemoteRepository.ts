import fs from "fs";
import { GaxiosError } from "gaxios";
import { google, sheets_v4 } from "googleapis";
import path from "path";

interface Config {
    spreadsheetId: string;
}

export class LocalConfigError extends Error {
    public constructor(public readonly cause?: unknown) {
        super("Unknown error while managing local config");
    }
}

export class SpreadsheetNotFoundError extends Error {
    public constructor(
        public readonly spreadsheetId: string,
        public readonly response?: { status: number; statusText: string; body: unknown; headers: Record<string, any> },
        public readonly cause?: unknown,
    ) {
        super("Could not get spreadsheet with id");
    }
}

export class CreateSpreadsheetError extends Error {
    public constructor(
        public readonly response?: { status: number; statusText: string; body: unknown; headers: Record<string, any> },
        public readonly cause?: unknown,
    ) {
        super("Could not create a new spreadsheet");
    }
}

export class RemoteRepository {
    private static readonly CONFIG_FILE_NAME = "furnace-montior.remote-repository.config.json";

    private sheets: sheets_v4.Sheets;
    private config: Config;
    private readonly apiPath = "https://sheets.googleapis.com";

    public constructor(private readonly keyPath: string, private readonly localConfigDirPath: string) {
        //
    }

    /**
     * Initialises the remote repository to work with the google sheets api
     * @throws InvalidKeyError if no valid key could be found
     */
    public async init(): Promise<void> {
        const auth = new google.auth.GoogleAuth({
            keyFile: this.keyPath,
            scopes: [
                "https://www.googleapis.com/auth/cloud-platform",
                "https://www.googleapis.com/auth/drive",
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/drive.resource",
                "https://www.googleapis.com/auth/spreadsheets",
                "https://spreadsheets.google.com/feeds",
                "https://spreadsheets.google.com/feeds/",
                "http://spreadsheets.google.com/feeds",
                "http://spreadsheets.google.com/feeds/",
                "https://spreadsheets.google.com/feeds/spreadsheets",
                "https://spreadsheets.google.com/feeds/spreadsheets/private/full",
                "http://spreadsheets.google.com/feeds/spreadsheets/private/full",
                "https://spreadsheets.google.com/feeds/worksheets/",
                "https://spreadsheets.google.com/tq",
                "https://spreadsheets.google.com/feeds/list/",
                "https://spreadsheets.google.com/feeds/worksheet/",
                "https://spreadsheets.google.com/feeds/cell/",
            ],
        });

        this.sheets = google.sheets({
            version: "v4",
            auth,
        });

        const config = await this.loadLocalConfig();
        if (!config) {
            const spreadsheetId = await this.initSpreadsheet();
            this.config = await this.initLocalConfig(spreadsheetId);
        } else {
            this.config = config;
            await this.checkSpreadsheetAccess(this.config.spreadsheetId);
        }
    }

    private async loadLocalConfig(): Promise<Config | undefined> {
        let result: Config | undefined;
        const localConfigFilePath = path.join(this.localConfigDirPath, RemoteRepository.CONFIG_FILE_NAME);
        try {
            const localConfigFile = await fs.promises.readFile(localConfigFilePath, "utf8");
            result = JSON.parse(localConfigFile) as Config;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw new LocalConfigError(error);
            }
        }
        return result;
    }

    private async initLocalConfig(spreadsheetId: string): Promise<Config> {
        const config: Config = {
            spreadsheetId,
        };
        const localConfigFilePath = path.join(this.localConfigDirPath, RemoteRepository.CONFIG_FILE_NAME);
        try {
            const configFile = JSON.stringify(config);
            await fs.promises.writeFile(localConfigFilePath, configFile, "utf8");
        } catch (error) {
            throw new LocalConfigError(error);
        }
        return config;
    }

    private async initSpreadsheet(): Promise<string> {
        let spreadsheetId: string;
        try {
            const createSpreadsheetResponse = await this.sheets.spreadsheets.create();
            if (!createSpreadsheetResponse.data.spreadsheetId) {
                throw new CreateSpreadsheetError(undefined, "Did not receive spreadsheetId in response");
            }
            spreadsheetId = createSpreadsheetResponse.data.spreadsheetId;
        } catch (error) {
            if ((error as GaxiosError).response) {
                const gaxiosError = error as GaxiosError;
                throw new CreateSpreadsheetError({
                    body: gaxiosError.response?.data,
                    headers: gaxiosError.response?.headers ?? {},
                    status: gaxiosError.response?.status ?? -1,
                    statusText: gaxiosError.response?.statusText ?? "UNKNOWN",
                });
            } else {
                throw new CreateSpreadsheetError(undefined, error);
            }
        }
        return spreadsheetId;
    }

    private async checkSpreadsheetAccess(spreadsheetId: string): Promise<void> {
        try {
            await this.sheets.spreadsheets.get({
                spreadsheetId,
            });
        } catch (error) {
            if ((error as GaxiosError).response) {
                const gaxiosError = error as GaxiosError;
                throw new SpreadsheetNotFoundError(spreadsheetId, {
                    body: gaxiosError.response?.data,
                    headers: gaxiosError.response?.headers ?? {},
                    status: gaxiosError.response?.status ?? -1,
                    statusText: gaxiosError.response?.statusText ?? "UNKNOWN",
                });
            } else {
                throw new SpreadsheetNotFoundError(spreadsheetId, undefined, error);
            }
        }
    }
}
