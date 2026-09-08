import { describe, it, expect } from "vitest";

import { parseWorldNumber, worldReadOffsets } from "./worldNumber";

describe("parseWorldNumber", () => {
    it("reads the world out of a line the OCR read", () => {
        expect(parseWorldNumber("e 215")).toBe("215");
    });

    it("reads a two digit world", () => {
        expect(parseWorldNumber("e 17")).toBe("17");
    });

    it("returns null when the reader stopped before the number", () => {
        expect(parseWorldNumber("RuneSca.")).toBe(null);
    });

    it("returns null for an empty read rather than throwing", () => {
        expect(parseWorldNumber("")).toBe(null);
        expect(parseWorldNumber(null)).toBe(null);
        expect(parseWorldNumber(undefined)).toBe(null);
    });
});

describe("worldReadOffsets", () => {
    it("tries the measured offset first", () => {
        expect(worldReadOffsets()[0]).toEqual({ dx: 52, dy: 4 });
    });

    it("offers the measured offset only once", () => {
        const measured = worldReadOffsets().filter((o) => o.dx === 52 && o.dy === 4);
        expect(measured).toHaveLength(1);
    });

    it("stays on the header line", () => {
        expect(worldReadOffsets().every((o) => o.dy >= 2 && o.dy <= 9)).toBe(true);
    });

    it("lands past the pretext without running off the end of the number", () => {
        expect(worldReadOffsets().every((o) => o.dx >= 45 && o.dx <= 80)).toBe(true);
    });
});
