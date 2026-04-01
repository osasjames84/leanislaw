/** Headers for JSON requests with optional JWT. */
export function authJsonHeaders(token) {
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

export function authBearerHeaders(token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
}
