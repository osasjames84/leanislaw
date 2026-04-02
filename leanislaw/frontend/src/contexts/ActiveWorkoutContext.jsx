import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "leanislaw_active_workout";
const ActiveWorkoutContext = createContext(null);

export function ActiveWorkoutProvider({ children }) {
    const [activeWorkout, setActiveWorkoutState] = useState(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return null;
            if (!parsed.sessionId || !parsed.startTimeMs) return null;
            return parsed;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        try {
            if (!activeWorkout) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activeWorkout));
        } catch {
            /* ignore storage issues */
        }
    }, [activeWorkout]);

    const setActiveWorkout = (next) => {
        setActiveWorkoutState((prev) => ({
            ...(prev || {}),
            ...(next || {}),
        }));
    };

    const clearActiveWorkout = () => setActiveWorkoutState(null);

    const value = useMemo(
        () => ({
            activeWorkout,
            setActiveWorkout,
            clearActiveWorkout,
        }),
        [activeWorkout]
    );

    return <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>;
}

export function useActiveWorkout() {
    const ctx = useContext(ActiveWorkoutContext);
    if (!ctx) throw new Error("useActiveWorkout must be used within ActiveWorkoutProvider");
    return ctx;
}
