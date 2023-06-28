import fs from "fs";
import { GaxiosError } from "gaxios";
import { drive_v3, google, sheets_v4 } from "googleapis";
import log from "loglevel";
import path from "path";
import { RemoteDatabaseConfig } from "./Config";

interface SpreadsheetData {
    spreadsheetId: string;
    spreadsheetUrl: string;
    authorisedUserEmails: string[];
}

interface InitSpreadsheetResult {
    spreadsheetId: string;
    spreadsheetUrl: string;
}

export class LocalSpreadsheetDataError extends Error {
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

export class AuthorizeUserError extends Error {
    public constructor(
        public readonly spreadsheetId: string,
        public readonly user: string,
        public readonly cause?: unknown,
    ) {
        super("Could not create a new spreadsheet");
    }
}

export class RemoteRepository {
    private static readonly CONFIG_FILE_NAME = "furnace-montior.remote-repository.config.json";

    private sheets: sheets_v4.Sheets;
    private drive: drive_v3.Drive;
    private spreadsheetData: SpreadsheetData;

    public constructor(private readonly config: RemoteDatabaseConfig, private readonly localConfigDirPath: string) {
        const auth = new google.auth.GoogleAuth({
            keyFile: this.config.keyPath,
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

        this.drive = google.drive({
            version: "v3",
            auth,
        });
    }

    /**
     * Initialises the remote repository to work with the google sheets api
     * @throws InvalidKeyError if no valid key could be found
     */
    public async init(): Promise<SpreadsheetData> {
        const spreadsheetData = await this.loadLocalSpreadsheetData();
        if (!spreadsheetData) {
            const { spreadsheetId, spreadsheetUrl } = await this.initSpreadsheet();
            this.spreadsheetData = {
                authorisedUserEmails: [],
                spreadsheetId,
                spreadsheetUrl,
            };
        } else {
            this.spreadsheetData = spreadsheetData;
            await this.checkSpreadsheetAccess(this.spreadsheetData.spreadsheetId);
        }

        const emailAddresses = Object.values(this.config.authorisedUsers).map((user) => user.email);
        const errors = await this.authoriseUsers();
        if (errors && errors.length > 0) {
            log.error("Could not authorise users", errors);
            this.spreadsheetData.authorisedUserEmails = this.spreadsheetData.authorisedUserEmails.filter(
                (email) => !errors.some((error) => error.user === email),
            );
        } else {
            this.spreadsheetData.authorisedUserEmails = emailAddresses;
        }

        await this.writeLocalSpreadsheetData(this.spreadsheetData);

        return this.spreadsheetData;
    }

    private async loadLocalSpreadsheetData(): Promise<SpreadsheetData | undefined> {
        let result: SpreadsheetData | undefined;
        const localSpreadsheetDataFilePath = path.join(this.localConfigDirPath, RemoteRepository.CONFIG_FILE_NAME);
        try {
            const localSpreadsheetDataFile = await fs.promises.readFile(localSpreadsheetDataFilePath, "utf8");
            result = JSON.parse(localSpreadsheetDataFile) as SpreadsheetData;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw new LocalSpreadsheetDataError(error);
            }
        }
        return result;
    }

    private async writeLocalSpreadsheetData(data: SpreadsheetData): Promise<void> {
        const localConfigFilePath = path.join(this.localConfigDirPath, RemoteRepository.CONFIG_FILE_NAME);
        try {
            const configFile = JSON.stringify(data);
            await fs.promises.writeFile(localConfigFilePath, configFile, "utf8");
        } catch (error) {
            throw new LocalSpreadsheetDataError(error);
        }
    }

    private async initSpreadsheet(): Promise<InitSpreadsheetResult> {
        let result: InitSpreadsheetResult;
        try {
            const createSpreadsheetResponse = await this.sheets.spreadsheets.create();
            if (!createSpreadsheetResponse.data.spreadsheetId) {
                throw new CreateSpreadsheetError(undefined, "Did not receive spreadsheetId in response");
            }
            if (!createSpreadsheetResponse.data.spreadsheetUrl) {
                throw new CreateSpreadsheetError(undefined, "Did not receive spreadsheetUrl in response");
            }
            result = {
                spreadsheetId: createSpreadsheetResponse.data.spreadsheetId,
                spreadsheetUrl: createSpreadsheetResponse.data.spreadsheetUrl,
            };
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
        return result;
    }

    private async authoriseUsers(): Promise<void | AuthorizeUserError[]> {
        const errors: AuthorizeUserError[] = [];
        for (const user of this.config.authorisedUsers) {
            // Only authorise users that are not already authorised
            if (this.spreadsheetData.authorisedUserEmails.includes(user.email)) {
                continue;
            }
            try {
                await this.drive.permissions.create({
                    fileId: this.spreadsheetData.spreadsheetId,
                    requestBody: {
                        type: "user",
                        role: "reader",
                        emailAddress: user.email,
                    },
                });
            } catch (error) {
                const authorizeUserError = new AuthorizeUserError(
                    this.spreadsheetData.spreadsheetId,
                    user.email,
                    error,
                );
                errors.push(authorizeUserError);
            }
        }
        if (errors.length > 0) {
            return errors;
        }
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
