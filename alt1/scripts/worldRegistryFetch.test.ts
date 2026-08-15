import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";

import { fetchRegistry, getMemberWorlds, getRegistry, resetRegistry } from "./worldRegistry";

vi.mock("axios");
vi.mock("../config", () => ({ API_URL: "https://api.test", DEBUG: false }));

const payload = {
    version: 7,
    memberWorlds: ["1", "2", "211"],
    specials: [{ key: "leagues", label: "Leagues", enabled: true, worlds: ["211"] }],
};

beforeEach(() => {
    resetRegistry();
    vi.mocked(axios.get).mockReset();
});

describe("fetchRegistry", () => {
    it("applies the registry the server returns", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: payload });

        await fetchRegistry();

        expect(getMemberWorlds()).toContain("211");
    });

    it("requests the registry endpoint", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: payload });

        await fetchRegistry();

        expect(vi.mocked(axios.get).mock.calls[0][0]).toBe("https://api.test/worlds/registry");
    });

    it("keeps the bundled fallback when the server is unreachable", async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error("network down"));

        await fetchRegistry();

        expect(getRegistry().version).toBe(0);
        expect(getMemberWorlds()).not.toContain("211");
    });

    it("keeps the bundled fallback when the server returns nonsense", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: { something: "else" } });

        await fetchRegistry();

        expect(getRegistry().version).toBe(0);
    });

    it("does not throw when the request fails, so startup continues", async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error("network down"));

        await expect(fetchRegistry()).resolves.toBeUndefined();
    });
});
