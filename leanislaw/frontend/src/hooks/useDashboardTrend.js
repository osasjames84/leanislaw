import { useCallback, useEffect, useMemo, useState } from "react";
import { authBearerHeaders } from "../apiHeaders";

export function useDashboardTrend(token, days = 35) {
    const [data, setData] = useState(null);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(() => Boolean(token));

    const load = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setData(null);
            return;
        }
        setLoading(true);
        setErr("");
        try {
            const res = await fetch(
                `/api/v1/tdee/dashboard-trend?days=${Math.min(90, Math.max(7, days))}`,
                { headers: authBearerHeaders(token) }
            );
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j.error || "Could not load trends");
            setData(j);
        } catch (e) {
            setErr(e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [token, days]);

    useEffect(() => {
        load();
    }, [load]);

    const series = data?.series ?? [];
    const stepsVals = useMemo(() => series.map((d) => d.steps ?? 0), [series]);
    const weightVals = useMemo(() => {
        let prev = null;
        return series.map((d) => {
            const v = d.weight_kg != null ? Number(d.weight_kg) : null;
            if (v != null) prev = v;
            return prev;
        });
    }, [series]);
    const tdeeVals = useMemo(() => {
        let prev = null;
        return series.map((d) => {
            const v = d.formula_tdee != null ? Number(d.formula_tdee) : null;
            if (v != null) prev = v;
            return prev;
        });
    }, [series]);

    const rangeLabel = useMemo(() => {
        if (!data?.range_start || !data?.range_end) return "";
        const a = new Date(data.range_start + "T12:00:00");
        const b = new Date(data.range_end + "T12:00:00");
        const fmt = (d) =>
            d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return `${fmt(a)} – ${fmt(b)}`;
    }, [data]);

    return {
        data,
        err,
        loading,
        reload: load,
        series,
        stepsVals,
        weightVals,
        tdeeVals,
        rangeLabel,
    };
}
