import { describe, it, expect } from "vitest";

import { parseAlt1Tile } from "./profileCounts";

describe("parseAlt1Tile", () => {
    it("splits a rendered tile into its base and first counts", () => {
        // The tile shows the combined total, so the base is what remains.
        expect(parseAlt1Tile("12 (First: 5)")).toEqual({ base: 7, first: 5 });
    });

    it("handles a tile with no firsts yet", () => {
        expect(parseAlt1Tile("3 (First: 0)")).toEqual({ base: 3, first: 0 });
    });

    it("handles a tile that is all firsts", () => {
        expect(parseAlt1Tile("5 (First: 5)")).toEqual({ base: 0, first: 5 });
    });

    it("handles a bare number from an older render", () => {
        expect(parseAlt1Tile("9")).toEqual({ base: 9, first: 0 });
    });

    it("handles an empty tile", () => {
        expect(parseAlt1Tile("")).toEqual({ base: 0, first: 0 });
    });

    it("handles null, which is what a missing element gives", () => {
        expect(parseAlt1Tile(null)).toEqual({ base: 0, first: 0 });
    });

    it("never reports a negative base if the text is inconsistent", () => {
        expect(parseAlt1Tile("2 (First: 5)")).toEqual({ base: 0, first: 5 });
    });
});
