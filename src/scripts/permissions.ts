interface AccessToken {
    discord_id: string;
    role_ids: string[];
    exp: number;
    iat: number;
    type: "access";
}

interface RefreshToken {
    discord_id: string;
    exp: number;
    iat: number;
    type: "refresh";
}

export type Token = AccessToken | RefreshToken;

export function decodeJWT(token: string): Token | null {
    try {
        const base64Url = token.split(".")[1]; // Get payload
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(base64)); // Decode base64
    } catch (e) {
        console.error("Invalid JWT token", e);
        return null;
    }
}

export function userHasRequiredRole(requiredRoles: string[]): boolean {
    const token = localStorage.getItem("accessToken");
    if (!token) return false;

    const decodedToken = decodeJWT(token);
    console.log(decodedToken, requiredRoles);
    if (
        !decodedToken ||
        decodedToken.type !== "access" ||
        !decodedToken.role_ids
    )
        return false;

    return decodedToken.role_ids.some((roleId: string) =>
        requiredRoles.includes(roleId),
    );
}
