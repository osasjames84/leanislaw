import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const TOKEN_KEY = "leanislaw_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUser(null);
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function loadMe() {
            if (!token) {
                setUser(null);
                setLoading(false);
                return;
            }
            try {
                const res = await fetch("/api/v1/auth/me", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    if (!cancelled) {
                        localStorage.removeItem(TOKEN_KEY);
                        setToken("");
                        setUser(null);
                    }
                } else {
                    const data = await res.json();
                    if (!cancelled) setUser(data);
                }
            } catch {
                if (!cancelled) {
                    localStorage.removeItem(TOKEN_KEY);
                    setToken("");
                    setUser(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadMe();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const login = useCallback(async (email, password) => {
        const res = await fetch("/api/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data.error || "Login failed");
            if (data.code) err.code = data.code;
            if (data.suggestPasswordReset) err.suggestPasswordReset = true;
            if (data.failedLoginCount != null) err.failedLoginCount = data.failedLoginCount;
            throw err;
        }
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const register = useCallback(async (payload) => {
        const res = await fetch("/api/v1/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || "Registration failed");
        }
        if (!data.token) {
            return { needsVerification: true, email: data.email };
        }
        localStorage.setItem(TOKEN_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const refreshUser = useCallback(async () => {
        if (!token) {
            setUser(null);
            return null;
        }
        try {
            const res = await fetch("/api/v1/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                localStorage.removeItem(TOKEN_KEY);
                setToken("");
                setUser(null);
                return null;
            }
            const data = await res.json();
            setUser(data);
            return data;
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            setToken("");
            setUser(null);
            return null;
        }
    }, [token]);

    const value = useMemo(
        () => ({
            token,
            user,
            loading,
            login,
            register,
            logout,
            refreshUser,
            isAuthenticated: Boolean(token && user),
        }),
        [token, user, loading, login, register, logout, refreshUser]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
