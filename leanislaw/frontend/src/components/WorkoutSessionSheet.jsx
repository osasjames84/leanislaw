import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkoutSession from "./WorkoutSession";

const overlay = {
    position: "fixed",
    inset: 0,
    zIndex: 220,
    pointerEvents: "none",
};

const shellBase = {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "100%",
    maxHeight: "100%",
    pointerEvents: "auto",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f2f2f7",
    boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
};

const grabberWrap = {
    flexShrink: 0,
    paddingTop: "calc(6px + env(safe-area-inset-top, 0px))",
    paddingBottom: 6,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "grab",
    touchAction: "none",
};

const grabberPill = {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#c7c7cc",
};

const body = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
};

export default function WorkoutSessionSheet({ sessionId }) {
    const navigate = useNavigate();
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const translateRef = useRef(0);
    const dragRef = useRef({ startY: 0, startTranslate: 0, active: false });

    const dismiss = useCallback(() => {
        navigate("/workout", { replace: true });
        translateRef.current = 0;
        setTranslateY(0);
    }, [navigate]);

    const flushTranslate = (v) => {
        translateRef.current = v;
        setTranslateY(v);
    };

    const endDrag = useCallback(() => {
        if (!dragRef.current.active) return;
        dragRef.current.active = false;
        setIsDragging(false);
        const ty = translateRef.current;
        const threshold = window.innerHeight * 0.18;
        if (ty > threshold) {
            dismiss();
        } else {
            flushTranslate(0);
        }
    }, [dismiss]);

    const onGrabPointerDown = (e) => {
        if (e.button === 2) return;
        e.preventDefault();
        e.stopPropagation();
        const p = "touches" in e ? e.touches[0] : e;
        dragRef.current = {
            startY: p.clientY,
            startTranslate: translateRef.current,
            active: true,
        };
        setIsDragging(true);

        const move = (ev) => {
            if (!dragRef.current.active) return;
            const pt = "touches" in ev ? ev.touches[0] : ev;
            if ("cancelable" in ev && ev.cancelable) ev.preventDefault();
            const dy = pt.clientY - dragRef.current.startY;
            flushTranslate(Math.max(0, dragRef.current.startTranslate + dy));
        };

        const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
            window.removeEventListener("touchmove", move);
            window.removeEventListener("touchend", up);
            window.removeEventListener("touchcancel", up);
            endDrag();
        };

        window.addEventListener("mousemove", move, { passive: false });
        window.addEventListener("mouseup", up);
        window.addEventListener("touchmove", move, { passive: false });
        window.addEventListener("touchend", up);
        window.addEventListener("touchcancel", up);
    };

    return (
        <div style={overlay} aria-hidden={false}>
            <div
                style={{
                    ...shellBase,
                    transform: `translateY(${translateY}px)`,
                    transition: isDragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                    willChange: "transform",
                }}
            >
                <div
                    role="presentation"
                    style={grabberWrap}
                    onMouseDown={onGrabPointerDown}
                    onTouchStart={onGrabPointerDown}
                >
                    <div style={grabberPill} />
                </div>
                <div style={body}>
                    <WorkoutSession sessionId={sessionId} sheetMode />
                </div>
            </div>
        </div>
    );
}
