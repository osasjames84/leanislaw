import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import { useActiveWorkout } from "../contexts/ActiveWorkoutContext";

const WIDGET_STORAGE = "leanislaw_active_workout_widget_pos";

const EXPANDED_W = 156;
const EXPANDED_H = 42;
const DOCK_PEEK = 18;
const DOCK_TOTAL_W = 52;
const DOCK_H = 64;
const EDGE_SNAP = 44;
const UNDOCK_DRAG_X = 28;

const wrapBase = {
    minHeight: "100vh",
    boxSizing: "border-box",
};

const islandLeft = {
    width: 22,
    height: 22,
    borderRadius: 8,
    background: "linear-gradient(135deg, #2d8cff, #0067d9)",
    color: "#fff",
    fontWeight: 800,
    fontSize: "0.8rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
};

const islandTime = {
    margin: 0,
    fontSize: "0.95rem",
    fontWeight: 800,
    color: "#fff",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.02em",
    minWidth: 56,
    textAlign: "right",
};

const chevronStyle = {
    color: "#fff",
    fontSize: "1.15rem",
    fontWeight: 200,
    lineHeight: 1,
    pointerEvents: "none",
};

function formatElapsed(startTimeMs, nowMs) {
    const diffMs = Math.max(0, nowMs - startTimeMs);
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readPersisted() {
    try {
        const raw = localStorage.getItem(WIDGET_STORAGE);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || typeof p !== "object" || !Number.isFinite(p.top)) return null;
        const dock = p.dock === "right" || p.dock === "left" ? p.dock : null;
        return {
            left: Number.isFinite(p.left) ? p.left : null,
            top: p.top,
            dock,
        };
    } catch {
        return null;
    }
}

const AppShell = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { activeWorkout } = useActiveWorkout();
    const [now, setNow] = useState(Date.now());

    const [dock, setDock] = useState(() => readPersisted()?.dock ?? null);
    const [widgetPos, setWidgetPos] = useState(() => {
        const p = readPersisted();
        if (!p) return null;
        return { left: p.left, top: p.top };
    });

    const dragRef = useRef({
        kind: "idle",
        startX: 0,
        startY: 0,
        originLeft: 0,
        originTop: 0,
        moved: false,
        lastDx: 0,
    });

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const showWidget = useMemo(() => {
        if (!activeWorkout?.sessionId) return false;
        const sid = String(activeWorkout.sessionId);
        return location.pathname !== `/workout/${sid}`;
    }, [activeWorkout, location.pathname]);

    const wrap = {
        ...wrapBase,
        paddingBottom: "calc(62px + env(safe-area-inset-bottom, 0px))",
    };

    const vvTop = () => (typeof window !== "undefined" ? window.visualViewport?.offsetTop || 0 : 0);
    const safeTop = () => 8 + vvTop();
    const bottomReserve = () => 70;

    const clampExpanded = useCallback((left, top) => {
        const minL = 8;
        const maxL = Math.max(8, window.innerWidth - EXPANDED_W - 8);
        const minT = safeTop();
        const maxT = Math.max(minT, window.innerHeight - EXPANDED_H - bottomReserve());
        return {
            left: Math.min(maxL, Math.max(minL, left)),
            top: Math.min(maxT, Math.max(minT, top)),
        };
    }, []);

    const clampDockTop = useCallback((top) => {
        const minT = safeTop();
        const maxT = Math.max(minT, window.innerHeight - DOCK_H - bottomReserve());
        return Math.min(maxT, Math.max(minT, top));
    }, []);

    useEffect(() => {
        if (!showWidget || !widgetPos) return;
        try {
            localStorage.setItem(
                WIDGET_STORAGE,
                JSON.stringify({
                    left: widgetPos.left,
                    top: widgetPos.top,
                    dock,
                })
            );
        } catch {
            /* ignore */
        }
    }, [widgetPos, dock, showWidget]);

    useEffect(() => {
        if (!showWidget) return;
        if (widgetPos != null) return;
        const usable = Math.max(0, window.innerHeight - safeTop() - bottomReserve());
        const midTop = safeTop() + Math.max(0, (usable - EXPANDED_H) / 2);
        setDock(null);
        setWidgetPos({
            left: Math.max(8, window.innerWidth - EXPANDED_W - 8),
            top: midTop,
        });
    }, [showWidget, widgetPos]);

    useEffect(() => {
        if (!showWidget) {
            setWidgetPos(null);
            setDock(null);
        }
    }, [showWidget]);

    const workoutInitial = (activeWorkout?.sessionName || "W").trim().charAt(0).toUpperCase() || "W";

    const expandFromRightDock = useCallback(() => {
        setDock(null);
        setWidgetPos((prev) => {
            const top = clampDockTop(prev?.top ?? safeTop() + 100);
            const { left } = clampExpanded(window.innerWidth - EXPANDED_W - 8, top);
            return { left, top };
        });
    }, [clampDockTop, clampExpanded]);

    const expandFromLeftDock = useCallback(() => {
        setDock(null);
        setWidgetPos((prev) => {
            const top = clampDockTop(prev?.top ?? safeTop() + 100);
            const { left, top: t } = clampExpanded(8, top);
            return { left, top: t };
        });
    }, [clampDockTop, clampExpanded]);

    const finishExpandedDrag = useCallback(() => {
        const { moved, lastDx, startX, startY } = dragRef.current;
        setWidgetPos((prev) => {
            if (!prev || prev.left == null) return prev;
            const { left, top } = prev;
            const right = left + EXPANDED_W;

            if (moved) {
                if (right > window.innerWidth - EDGE_SNAP) {
                    setDock("right");
                    return { left: null, top: clampDockTop(top) };
                }
                if (left < EDGE_SNAP) {
                    setDock("left");
                    return { left: null, top: clampDockTop(top) };
                }
            }
            return prev;
        });

        if (!moved && activeWorkout?.sessionId != null) {
            navigate(`/workout/${activeWorkout.sessionId}`);
        }
    }, [activeWorkout?.sessionId, navigate, clampDockTop]);

    const finishDockRightDrag = useCallback(() => {
        const { moved, lastDx } = dragRef.current;
        if (moved && lastDx < -UNDOCK_DRAG_X) {
            expandFromRightDock();
        } else if (!moved) {
            expandFromRightDock();
        }
    }, [expandFromRightDock]);

    const finishDockLeftDrag = useCallback(() => {
        const { moved, lastDx } = dragRef.current;
        if (moved && lastDx > UNDOCK_DRAG_X) {
            expandFromLeftDock();
        } else if (!moved) {
            expandFromLeftDock();
        }
    }, [expandFromLeftDock]);

    const startDrag = useCallback(
        (e, kind) => {
            if (e.button === 2) return;
            e.preventDefault();
            e.stopPropagation();
            const p = "touches" in e ? e.touches[0] : e;
            const cur = widgetPos || { left: 8, top: safeTop() };

            dragRef.current = {
                kind,
                startX: p.clientX,
                startY: p.clientY,
                originLeft: cur.left ?? 0,
                originTop: cur.top,
                moved: false,
                lastDx: 0,
            };

            const onMove = (ev) => {
                const pt = "touches" in ev ? ev.touches[0] : ev;
                if ("cancelable" in ev && ev.cancelable) ev.preventDefault();
                const dx = pt.clientX - dragRef.current.startX;
                const dy = pt.clientY - dragRef.current.startY;
                dragRef.current.lastDx = dx;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;

                if (kind === "expanded") {
                    const nl = dragRef.current.originLeft + dx;
                    const nt = dragRef.current.originTop + dy;
                    const c = clampExpanded(nl, nt);
                    setDock(null);
                    setWidgetPos({ left: c.left, top: c.top });
                } else if (kind === "dock-right" || kind === "dock-left") {
                    const nt = clampDockTop(dragRef.current.originTop + dy);
                    setWidgetPos((wp) => ({ ...wp, left: wp?.left ?? null, top: nt }));
                }
            };

            const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
                window.removeEventListener("touchmove", onMove);
                window.removeEventListener("touchend", onUp);
                window.removeEventListener("touchcancel", onUp);

                const k = dragRef.current.kind;
                dragRef.current.kind = "idle";

                if (k === "expanded") finishExpandedDrag();
                else if (k === "dock-right") finishDockRightDrag();
                else if (k === "dock-left") finishDockLeftDrag();
            };

            window.addEventListener("mousemove", onMove, { passive: false });
            window.addEventListener("mouseup", onUp);
            window.addEventListener("touchmove", onMove, { passive: false });
            window.addEventListener("touchend", onUp);
            window.addEventListener("touchcancel", onUp);
        },
        [widgetPos, clampExpanded, clampDockTop, finishExpandedDrag, finishDockRightDrag, finishDockLeftDrag]
    );

    // Typo: finishDockLeftDock -> finishDockLeftDrag
    // Fix the dependency array

    return (
        <div style={wrap}>
            <Outlet />
            {showWidget && widgetPos ? (
                <>
                    {dock === "right" ? (
                        <div
                            role="button"
                            aria-label="Workout hidden on edge. Drag left to expand or tap."
                            title="Drag left to expand. Tap to peek out."
                            style={{
                                position: "fixed",
                                zIndex: 140,
                                right: 0,
                                top: clampDockTop(widgetPos.top),
                                width: DOCK_TOTAL_W,
                                height: DOCK_H,
                                transform: `translateX(calc(100% - ${DOCK_PEEK}px))`,
                                borderRadius: "14px 0 0 14px",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRight: "none",
                                backgroundColor: "rgba(0,0,0,0.88)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                boxShadow: "-4px 0 18px rgba(0,0,0,0.35)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                paddingLeft: 7,
                                cursor: "grab",
                                userSelect: "none",
                                touchAction: "none",
                                boxSizing: "border-box",
                            }}
                            onMouseDown={(e) => startDrag(e, "dock-right")}
                            onTouchStart={(e) => startDrag(e, "dock-right")}
                        >
                            <span style={chevronStyle} aria-hidden>
                                ‹
                            </span>
                        </div>
                    ) : dock === "left" ? (
                        <div
                            role="button"
                            aria-label="Workout docked left. Drag right to expand."
                            style={{
                                position: "fixed",
                                zIndex: 140,
                                left: 0,
                                top: clampDockTop(widgetPos.top),
                                width: DOCK_TOTAL_W,
                                height: DOCK_H,
                                transform: `translateX(calc(-100% + ${DOCK_PEEK}px))`,
                                borderRadius: "0 14px 14px 0",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderLeft: "none",
                                backgroundColor: "rgba(0,0,0,0.88)",
                                backdropFilter: "blur(12px)",
                                WebkitBackdropFilter: "blur(12px)",
                                boxShadow: "4px 0 18px rgba(0,0,0,0.35)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                paddingRight: 7,
                                cursor: "grab",
                                userSelect: "none",
                                touchAction: "none",
                                boxSizing: "border-box",
                            }}
                            onMouseDown={(e) => startDrag(e, "dock-left")}
                            onTouchStart={(e) => startDrag(e, "dock-left")}
                        >
                            <span style={chevronStyle} aria-hidden>
                                ›
                            </span>
                        </div>
                    ) : (
                        <div
                            role="button"
                            aria-label="Resume active workout"
                            title="Drag to move. Snap to edge to dock. Tap to open."
                            style={{
                                position: "fixed",
                                zIndex: 140,
                                left: widgetPos.left ?? 8,
                                top: widgetPos.top,
                                width: EXPANDED_W,
                                minHeight: EXPANDED_H,
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.08)",
                                backgroundColor: "rgba(0,0,0,0.92)",
                                backdropFilter: "blur(10px)",
                                WebkitBackdropFilter: "blur(10px)",
                                padding: "8px 10px",
                                boxShadow: "0 8px 22px rgba(0,0,0,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                                cursor: "grab",
                                userSelect: "none",
                                touchAction: "none",
                                boxSizing: "border-box",
                            }}
                            onMouseDown={(e) => startDrag(e, "expanded")}
                            onTouchStart={(e) => startDrag(e, "expanded")}
                        >
                            <span style={islandLeft}>{workoutInitial}</span>
                            <p style={islandTime}>{formatElapsed(activeWorkout.startTimeMs || Date.now(), now)}</p>
                        </div>
                    )}
                </>
            ) : null}
            <BottomNav />
        </div>
    );
};

export default AppShell;
