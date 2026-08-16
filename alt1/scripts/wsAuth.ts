/**
 * Websocket authentication.
 *
 * The server only sends Misty world state to connections it can identify, and
 * identity comes from a verified token rather than the discord_id the client
 * used to assert in the connect URL.
 *
 * The token travels in a frame rather than the query string: URLs end up in
 * proxy logs, browser history and server access logs, and a JWT there outlives
 * the request. Sending it after the socket opens also means a token refreshed
 * mid-session can be re-sent without tearing down the connection.
 */

type SendableSocket = Pick<WebSocket, "readyState" | "send">;

export function buildAuthMessage(token: string): string {
    return JSON.stringify({ type: "AUTH", token });
}

/**
 * Send the token over an open socket. Returns whether anything was sent.
 *
 * A missing token is normal: the app is usable without linking Discord, and
 * such a connection stays a guest with public access.
 */
export function sendAuth(socket: SendableSocket | null, token: string | null): boolean {
    if (!socket || !token) return false;
    if (socket.readyState !== WebSocket.OPEN) return false;

    socket.send(buildAuthMessage(token));
    return true;
}
