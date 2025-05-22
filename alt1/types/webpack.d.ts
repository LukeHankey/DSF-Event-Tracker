/* eslint-disable @typescript-eslint/no-explicit-any */
declare function require(context: string): any;
declare namespace require {
    function context(
        directory: string,
        useSubdirectories: boolean,
        regExp: RegExp,
    ): {
        keys(): string[];
        (id: string): string;
    };
}
