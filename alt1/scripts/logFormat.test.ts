import { describe, it, expect } from "vitest";

import { prepareLog } from "./logFormat";

describe("prepareLog", () => {
    it("keeps an error's message instead of logging {}", () => {
        const line = prepareLog([new Error("World not found")]);
        expect(line).toContain("World not found");
        expect(line).not.toBe("{}");
    });

    it("keeps the message when an error has no stack", () => {
        const err = new Error("World not found");
        err.stack = undefined;
        expect(prepareLog([err])).toBe("Error: World not found");
    });

    it("still serializes plain objects", () => {
        expect(prepareLog([{ world: 215 }])).toBe('{"world":215}');
    });

    it("survives a circular object", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => prepareLog([circular])).not.toThrow();
    });

    it("joins mixed arguments with a space", () => {
        expect(prepareLog(["world", 215, null])).toBe("world 215 null");
    });
});
