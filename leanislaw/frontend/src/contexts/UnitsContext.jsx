import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FOOD_UNIT_KEY, UNIT_KEY, readStoredFoodUnit, readStoredUnits } from "../units";

const UnitsContext = createContext(null);

export function UnitsProvider({ children }) {
    const [units, setUnitsState] = useState(readStoredUnits);
    const [foodUnit, setFoodUnitState] = useState(readStoredFoodUnit);

    useEffect(() => {
        const onStorage = (e) => {
            if (e.storageArea !== localStorage) return;
            if (e.key === UNIT_KEY) setUnitsState(readStoredUnits());
            if (e.key === FOOD_UNIT_KEY) setFoodUnitState(readStoredFoodUnit());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const setUnits = useCallback((next) => {
        setUnitsState(next);
        try {
            localStorage.setItem(UNIT_KEY, next);
        } catch {
            /* ignore */
        }
    }, []);

    const setFoodUnit = useCallback((next) => {
        setFoodUnitState(next);
        try {
            localStorage.setItem(FOOD_UNIT_KEY, next);
        } catch {
            /* ignore */
        }
    }, []);

    const value = useMemo(
        () => ({ units, setUnits, foodUnit, setFoodUnit }),
        [units, setUnits, foodUnit, setFoodUnit]
    );

    return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
    const ctx = useContext(UnitsContext);
    if (!ctx) {
        throw new Error("useUnits must be used within UnitsProvider");
    }
    return ctx;
}
