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

describe("fetchRegistry notifies when it has applied", () => {
    it("calls back after a successful fetch, so the UI can re-render", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: payload });
        const onApplied = vi.fn();

        await fetchRegistry(onApplied);

        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it("does not call back when the server is unreachable", async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error("network down"));
        const onApplied = vi.fn();

        await fetchRegistry(onApplied);

        expect(onApplied).not.toHaveBeenCalled();
    });

    it("still calls back when only the feature window changed", async () => {
        // The registry itself may be unchanged while a window opened; the tab
        // still has to re-render or it stays locked until something else moves.
        vi.mocked(axios.get).mockResolvedValue({
            data: { ...payload, mistyPublic: { open: true, until: null, reason: "DXP" } },
        });
        const onApplied = vi.fn();

        await fetchRegistry(onApplied);

        expect(onApplied).toHaveBeenCalledTimes(1);
    });

    it("works without a callback", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: payload });

        await expect(fetchRegistry()).resolves.toBeUndefined();
    });
});
