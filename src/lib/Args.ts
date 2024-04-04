export class ArgumentNotFoundError extends Error {
    public constructor(public readonly argumentName: string) {
        super(`Argument '${argumentName}' not found`);
    }
}

export class ArgumentParsingError extends Error {
    public constructor(public readonly argumentName: string, public readonly error: Error) {
        super(`Failed to parse argument ${argumentName}: ${error.message}`);
    }
}

export class Args {
    public constructor(private readonly args: string[]) {
        //
    }

    public get length(): number {
        return this.args.length;
    }

    /**
     * Get the value of an argument
     * @param name
     * @returns the value as a string. Will return undefined if the argument is a flag, but present
     * @throws ArgumentNotFoundError if the argument is not found
     */
    public get(name: string): string | true {
        const index = this.args.indexOf(name);
        if (index === -1) {
            throw new ArgumentNotFoundError(name);
        }
        const value = this.args[index + 1];
        if (value === undefined || value.startsWith("-")) {
            return true;
        } else {
            return value;
        }
    }
}
