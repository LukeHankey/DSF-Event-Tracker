import axios from "axios";

import { API_URL } from "../config";

/**
 * End the session.
 *
 * Clearing the Discord ID field used to look like signing out while the tokens
 * stayed in local storage — the app carried on as the previous user, and the
 * refresh token behind it is valid for a year. So this has to do three things:
 * tell the server to revoke the refresh token, drop both tokens locally, and
 * let the caller re-render whatever depended on being signed in.
 */
export async function signOut(): Promise<void> {
    const refreshToken = localStorage.getItem("refreshToken");

    if (refreshToken) {
        try {
            await axios.post(`${API_URL}/auth/logout`, { token: refreshToken });
        } catch (error) {
            // Local tokens are cleared regardless: a network blip must not leave
            // someone signed in on a machine they meant to sign out of. The
            // refresh token stays valid server-side until it expires, which is
            // why the request is attempted first.
            console.error("Could not revoke the session server-side:", error);
        }
    }

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    // The form field is how someone identifies themselves; leaving it filled in
    // after signing out invites the same confusion again.
    localStorage.removeItem("discordID");
}
