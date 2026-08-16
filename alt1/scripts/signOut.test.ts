import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";

import { signOut } from "./signOut";

vi.mock("axios");
vi.mock("../config", () => ({ API_URL: "https://api.test", DEBUG: false }));

// A stub rather than jsdom: this module only needs key/value storage, and the
// rest of the suite runs in node.
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
});

beforeEach(() => {
    localStorage.clear();
    vi.mocked(axios.post).mockReset();
    vi.mocked(axios.post).mockResolvedValue({ data: { message: "Signed out" } });
});

describe("signOut", () => {
    it("clears both tokens", async () => {
        localStorage.setItem("accessToken", "a");
        localStorage.setItem("refreshToken", "r");

        await signOut();

        expect(localStorage.getItem("accessToken")).toBeNull();
        expect(localStorage.getItem("refreshToken")).toBeNull();
    });

    it("asks the server to revoke the refresh token", async () => {
        localStorage.setItem("refreshToken", "r");

        await signOut();

        expect(vi.mocked(axios.post).mock.calls[0][0]).toBe("https://api.test/auth/logout");
        expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({ token: "r" });
    });

    it("clears tokens even when the server call fails", async () => {
        // Otherwise a network blip would leave the user signed in on a machine
        // they meant to sign out of.
        localStorage.setItem("accessToken", "a");
        localStorage.setItem("refreshToken", "r");
        vi.mocked(axios.post).mockRejectedValue(new Error("offline"));

        await signOut();

        expect(localStorage.getItem("accessToken")).toBeNull();
        expect(localStorage.getItem("refreshToken")).toBeNull();
    });

    it("does not call the server when there is no refresh token", async () => {
        await signOut();

        expect(axios.post).not.toHaveBeenCalled();
    });

    it("clears the stored discord id so the form matches the session", async () => {
        localStorage.setItem("discordID", "123");
        localStorage.setItem("refreshToken", "r");

        await signOut();

        expect(localStorage.getItem("discordID")).toBeNull();
    });

    it("leaves unrelated settings alone", async () => {
        localStorage.setItem("notificationModes", '["toolbar"]');
        localStorage.setItem("refreshToken", "r");

        await signOut();

        expect(localStorage.getItem("notificationModes")).toBe('["toolbar"]');
    });
});
