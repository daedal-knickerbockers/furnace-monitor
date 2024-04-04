import { Database, Statement } from "sqlite";

export class DatabaseTransaction {
    private static BEGIN_STATEMENT: Statement;
    private static COMMIT_STATEMENT: Statement;

    public constructor(private readonly db: Database) {
        //
    }

    public async runBatchAsync(statements: Statement[]): Promise<any[]> {
        if (!DatabaseTransaction.BEGIN_STATEMENT) {
            DatabaseTransaction.BEGIN_STATEMENT = await this.db.prepare("BEGIN");
        }

        if (!DatabaseTransaction.COMMIT_STATEMENT) {
            DatabaseTransaction.COMMIT_STATEMENT = await this.db.prepare("COMMIT");
        }

        const results: any[] = [];
        const statementsToExecute = [
            DatabaseTransaction.BEGIN_STATEMENT,
            ...statements,
            DatabaseTransaction.COMMIT_STATEMENT,
        ];
        for (const [index, statement] of statementsToExecute.entries()) {
            try {
                results.push(await statement.run());
            } catch (err) {
                throw new Error(`${err as string} in statement #${index}`);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return results.slice(1, -1);
    }
}
