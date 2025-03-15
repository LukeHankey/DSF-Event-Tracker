function decodeJWT(token: string) {
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
    if (!decodedToken || !decodedToken.role_ids) return false;

    return decodedToken.role_ids.some((roleId: string) =>
        requiredRoles.includes(roleId),
    );
}
