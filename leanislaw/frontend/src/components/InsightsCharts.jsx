import { useMemo } from "react";

const DEFAULT_W = 320;

export function sparkPoints(values, width, height, pad = 6) {
    const clean = values.map((v) => (Number.isFinite(Number(v)) ? Number(v) : null));
    const nums = clean.filter((v) => v != null);
    if (nums.length < 2) return { line: "", fill: "", last: nums[0] ?? null };
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const n = clean.length;
    const pts = clean.map((v, i) => {
        if (v == null) return null;
        const x = pad + (i / (n - 1)) * (width - 2 * pad);
        const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
        return { x, y };
    });
    const line = pts
        .filter(Boolean)
        .map((p) => `${p.x},${p.y}`)
        .join(" ");
    const firstX = pts.find(Boolean)?.x ?? pad;
    const lastX = [...pts].reverse().find(Boolean)?.x ?? width - pad;
    const bottom = height - pad;
    const fillPts = pts
        .filter(Boolean)
        .map((p) => `${p.x},${p.y}`)
        .concat(`${lastX},${bottom}`, `${firstX},${bottom}`)
        .join(" ");
    return { line, fill: fillPts, last: nums[nums.length - 1] };
}

function yTicks(min, max, height, pad) {
    const span = max - min || 1;
    const vals = [min, min + span / 2, max];
    return vals.map((v) => ({
        value: v,
        y: pad + (1 - (v - min) / span) * (height - 2 * pad),
    }));
}

/** Wider than the card = horizontal scroll so the full trend is reachable on mobile. */
export function MiniChart({
    values,
    color,
    fillColor,
    height = 56,
    minPixelWidth = DEFAULT_W,
    showPoints = true,
    activeIndex = null,
}) {
    const w = useMemo(() => {
        const n = values?.length ?? 0;
        const per = n > 40 ? 5 : n > 25 ? 7 : 9;
        return Math.max(minPixelWidth, Math.max(2, n) * per + 24);
    }, [values, minPixelWidth]);

    const { line, fill } = useMemo(
        () => sparkPoints(values, w, height, 8),
        [values, w, height]
    );
    const clean = useMemo(
        () => values.map((v) => (Number.isFinite(Number(v)) ? Number(v) : null)),
        [values]
    );
    const nums = useMemo(() => clean.filter((v) => v != null), [clean]);
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 1;
    const span = max - min || 1;
    const points = useMemo(() => {
        const pad = 8;
        const n = clean.length;
        return clean.map((v, i) => {
            if (v == null) return null;
            const x = pad + (i / Math.max(1, n - 1)) * (w - 2 * pad);
            const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
            return { x, y, i };
        });
    }, [clean, w, min, span, height]);
    const ticks = useMemo(() => yTicks(min, max, height, 8), [min, max, height]);

    return (
        <div
            style={{
                width: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                WebkitOverflowScrolling: "touch",
                marginLeft: -4,
                marginRight: -4,
                paddingBottom: 4,
            }}
            role="img"
            aria-label="Trend chart"
        >
            <svg
                width={w}
                height={height}
                viewBox={`0 0 ${w} ${height}`}
                preserveAspectRatio="xMinYMid meet"
                style={{ display: "block", flexShrink: 0 }}
            >
                {ticks.map((t, idx) => (
                    <line
                        key={`grid-${idx}`}
                        x1={0}
                        y1={t.y}
                        x2={w}
                        y2={t.y}
                        stroke="#e5e5ea"
                        strokeWidth={0.8}
                    />
                ))}
                {line ? (
                    <>
                        <polygon points={fill} fill={fillColor} opacity={0.18} />
                        <polyline
                            points={line}
                            fill="none"
                            stroke={color}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        {showPoints
                            ? points
                                  .filter(Boolean)
                                  .map((p) => (
                                      <circle
                                          key={`pt-${p.i}`}
                                          cx={p.x}
                                          cy={p.y}
                                          r={activeIndex === p.i ? 3.6 : 2.2}
                                          fill="#fff"
                                          stroke={color}
                                          strokeWidth={activeIndex === p.i ? 2 : 1.2}
                                      />
                                  ))
                            : null}
                    </>
                ) : null}
            </svg>
        </div>
    );
}
