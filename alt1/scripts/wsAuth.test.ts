import { describe, it, expect, vi } from "vitest";

import { buildAuthMessage, sendAuth } from "./wsAuth";

const openSocket = () => ({ readyState: WebSocket.OPEN, send: vi.fn() });

describe("buildAuthMessage", () => {
    it("is an AUTH frame carrying the token", () => {
        expect(JSON.parse(buildAuthMessage("abc"))).toEqual({ type: "AUTH", token: "abc" });
    });
});

describe("sendAuth", () => {
    it("sends the frame when the socket is open and a token exists", () => {
        const socket = openSocket();

        expect(sendAuth(socket, "abc")).toBe(true);
        expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({ type: "AUTH", token: "abc" });
    });

    it("does nothing without a token, so guests stay guests", () => {
        const socket = openSocket();

        expect(sendAuth(socket, null)).toBe(false);
        expect(socket.send).not.toHaveBeenCalled();
    });

    it("does nothing when the socket is not open", () => {
        const socket = { readyState: WebSocket.CONNECTING, send: vi.fn() };

        expect(sendAuth(socket, "abc")).toBe(false);
        expect(socket.send).not.toHaveBeenCalled();
    });

    it("does nothing when there is no socket at all", () => {
        expect(sendAuth(null, "abc")).toBe(false);
    });

    it("never puts the token in a URL", () => {
        // The token goes in a frame, not the query string: query strings end up
        // in proxy and access logs.
        const socket = openSocket();
        sendAuth(socket, "abc");

        expect(socket.send.mock.calls[0][0]).not.toMatch(/^ws/);
    });
});
