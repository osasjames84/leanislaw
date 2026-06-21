/**
 * Shared coach-console UI primitives + helpers. Used by CoachConsole (roster)
 * and CoachClientProfile (full client page). Styling = inline + --cc-* tokens
 * (warm-charcoal dark), matching index.css.
 */
import { authBearerHeaders } from "../apiHeaders";

export const STATUS = {
    needs_attention: { label: "Needs attention", bg: "var(--cc-na-bg)", fg: "var(--cc-na-fg)" },
    watch: { label: "Watch", bg: "var(--cc-watch-bg)", fg: "var(--cc-watch-fg)" },
    on_track: { label: "On track", bg: "var(--cc-ot-bg)", fg: "var(--cc-ot-fg)" },
};
export const STATUS_ORDER = { needs_attention: 0, watch: 1, on_track: 2 };

export function statusColor(p) {
    if (p == null) return "var(--cc-text3)";
    return p >= 80 ? "var(--cc-success)" : p >= 50 ? "var(--cc-warning)" : "var(--cc-danger)";
}

export function initials(name = "") {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// True minus sign (U+2212) for negative numbers.
export const minusSign = (n) => `${n}`.replace("-", "−");
export const signed = (n) => `${n > 0 ? "+" : ""}${minusSign(n)}`;

// Shorten the fast-drop coaching flag and use a true minus elsewhere.
export function displayFlag(flag, trend) {
    if (!flag) return flag;
    if (/fast weekly drop/i.test(flag) && trend) {
        const pct = Math.round(trend.pct_change * 10) / 10;
        return `Fast weekly drop (${minusSign(pct)}%) — check in before pushing the deficit`;
    }
    return flag.replace(/-/g, "−");
}

export async function openBlob(url, token, onErr) {
    try {
        const r = await fetch(url, { headers: authBearerHeaders(token) });
        if (!r.ok) return onErr && onErr("Could not open that file.");
        const u = URL.createObjectURL(await r.blob());
        window.open(u, "_blank");
        setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch {
        onErr && onErr("Could not open that file.");
    }
}

export function Pill({ status }) {
    const s = STATUS[status] || { label: status, bg: "var(--cc-panel2)", fg: "var(--cc-text2)" };
    return (
        <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "5px 12px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
            {s.label}
        </span>
    );
}

export function Avatar({ name, status, size = 28 }) {
    const s = STATUS[status] || { bg: "var(--cc-accent-bg)", fg: "var(--cc-accent)" };
    return (
        <div style={{ width: size, height: size, borderRadius: "50%", background: s.bg, color: s.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size < 30 ? 11 : 13, fontWeight: 600, flexShrink: 0 }}>
            {initials(name)}
        </div>
    );
}

export function Bar({ pct }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
            <div style={{ flex: 1, height: 12, borderRadius: 999, background: "var(--cc-track)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, pct ?? 0)}%`, background: statusColor(pct), borderRadius: 999 }} />
            </div>
            <span style={{ color: "var(--cc-text2)", fontSize: 12, fontWeight: 500, width: 30, textAlign: "right" }}>{pct ?? "—"}%</span>
        </div>
    );
}

export function StatCard({ label, value, color }) {
    return (
        <div style={{ background: "var(--cc-tile)", border: "1px solid var(--cc-border)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "var(--cc-text2)", fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: color || "var(--cc-text)", marginTop: 6, letterSpacing: -0.2 }}>{value}</div>
        </div>
    );
}

export function AlertBanner({ text, tone = "alert" }) {
    const bg = tone === "alert" ? "var(--cc-alert-bg)" : "var(--cc-accent-bg)";
    const border = tone === "alert" ? "var(--cc-alert-border)" : "var(--cc-border)";
    const fg = tone === "alert" ? "var(--cc-alert-fg)" : "var(--cc-text)";
    const icon = tone === "alert" ? "ti-alert-triangle" : "ti-info-circle";
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: bg, border: `1px solid ${border}`, color: fg, borderRadius: 12, padding: "12px 16px", fontSize: 12.5, fontWeight: 500 }}>
            <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }} />
            {text}
        </div>
    );
}

export function Empty({ text }) {
    return <p style={{ color: "var(--cc-text3)", fontSize: 13, margin: "6px 0" }}>{text}</p>;
}

export function MetricLine({ series, unit }) {
    const pts = (series || []).filter((p) => p.value != null);
    if (pts.length < 2) return <Empty text="Not enough data yet" />;
    const w = 520, h = 130, pad = 30;
    const vals = pts.map((p) => p.value);
    const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
    const x = (i) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
    const y = (v) => h - pad - ((v - min) / rng) * (h - 2 * pad);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
            <path d={d} fill="none" strokeWidth="2.5" style={{ stroke: "var(--cc-accent)" }} />
            {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="3" style={{ fill: "var(--cc-accent)" }} />)}
            <text x={pad} y={14} fontSize="11" style={{ fill: "var(--cc-text3)" }}>{max}{unit}</text>
            <text x={pad} y={h - 8} fontSize="11" style={{ fill: "var(--cc-text3)" }}>{min}{unit}</text>
        </svg>
    );
}

export function Sparkline({ values }) {
    const pts = (values || []).filter((v) => v != null);
    if (pts.length < 2) return null;
    const w = 120, h = 30;
    const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
    const x = (i) => (i * w) / (pts.length - 1);
    const y = (v) => h - 3 - ((v - min) / rng) * (h - 6);
    const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ flexShrink: 0 }}>
            <path d={d} fill="none" strokeWidth="2" style={{ stroke: "var(--cc-accent)" }} />
        </svg>
    );
}

export function ProgressionItem({ p }) {
    const up = p.delta_1rm != null && p.delta_1rm > 0;
    const down = p.delta_1rm != null && p.delta_1rm < 0;
    const deltaColor = up ? "var(--cc-success)" : down ? "var(--cc-danger)" : "var(--cc-text2)";
    return (
        <div style={{ background: "var(--cc-tile)", border: "1px solid var(--cc-border)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)" }}>{p.exercise}</div>
                    <div style={{ fontSize: 11.5, color: "var(--cc-text3)", textTransform: "capitalize" }}>{p.body_part}</div>
                </div>
                <Sparkline values={p.weeks.map((wk) => wk.est_1rm)} />
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12.5 }}>
                <span style={{ color: "var(--cc-text2)" }}>Top set <strong style={{ color: "var(--cc-text)" }}>{p.latest.top_weight}kg × {p.latest.top_reps}</strong></span>
                <span style={{ color: "var(--cc-text2)" }}>est. 1RM <strong style={{ color: "var(--cc-text)" }}>{p.latest.est_1rm}kg</strong></span>
                {p.delta_1rm != null ? <span style={{ color: deltaColor, fontWeight: 600 }}>{signed(p.delta_1rm)} vs last</span> : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--cc-accent)", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="ti ti-bulb" aria-hidden="true" style={{ fontSize: 14 }} />{p.suggestion}
            </div>
        </div>
    );
}

export function MiniNutrition({ days, target }) {
    if (!days || !days.length) return <Empty text="No nutrition logged this week" />;
    const w = 520, h = 150, pad = 28;
    const max = Math.max(target || 0, ...days.map((d) => d.calories)) * 1.12 || 1;
    const bw = (w - 2 * pad) / days.length;
    const ty = target ? h - pad - (target / max) * (h - 2 * pad) : null;
    return (
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%" }}>
            {days.map((d, i) => {
                const bh = (d.calories / max) * (h - 2 * pad);
                const over = target && d.calories > target;
                return <rect key={i} x={pad + i * bw + 4} y={h - pad - bh} width={bw - 8} height={bh} rx="3" style={{ fill: over ? "var(--cc-danger)" : "var(--cc-success)" }} />;
            })}
            {ty != null ? <line x1={pad} y1={ty} x2={w - pad} y2={ty} strokeDasharray="4 3" style={{ stroke: "var(--cc-text3)" }} /> : null}
            {ty != null ? <text x={w - pad} y={ty - 5} fontSize="11" textAnchor="end" style={{ fill: "var(--cc-text3)" }}>target {target}</text> : null}
        </svg>
    );
}
