import { useMemo } from "react";
import { matchPath, useLocation } from "react-router-dom";
import WorkoutHub from "./WorkoutHub";
import WorkoutSessionSheet from "./WorkoutSessionSheet";

/**
 * Strong-style: WorkoutHub stays mounted; session opens as a draggable sheet overlay.
 */
export default function WorkoutArea() {
    const location = useLocation();

    const sessionId = useMemo(() => {
        const m = matchPath({ path: "/workout/:sessionId", end: true }, location.pathname);
        return m?.params?.sessionId ?? null;
    }, [location.pathname]);

    return (
        <div style={{ position: "relative", minHeight: "100vh", width: "100%" }}>
            <div
                style={{
                    pointerEvents: sessionId ? "none" : "auto",
                    userSelect: sessionId ? "none" : "auto",
                }}
                aria-hidden={!!sessionId}
            >
                <WorkoutHub />
            </div>
            {sessionId ? <WorkoutSessionSheet sessionId={sessionId} /> : null}
        </div>
    );
}
