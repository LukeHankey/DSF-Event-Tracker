/**
 * Formatting for the console output mirrored to the server over the websocket.
 *
 * Kept out of ws.ts, which opens a connection as soon as it is imported.
 */
export const prepareLog = (args: unknown[]): string =>
    args
        .map((arg) => {
            // JSON.stringify(new Error("boom")) is "{}", which is what production
            // logs were filling up with. The stack already carries name and message.
            if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
            if (typeof arg === "object" && arg !== null) {
                try {
                    return JSON.stringify(arg);
                } catch {
                    // Circular, or a value JSON cannot represent.
                    return String(arg);
                }
            }
            return String(arg);
        })
        .join(" ");
