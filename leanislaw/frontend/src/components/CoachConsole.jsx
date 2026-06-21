import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import CoachExerciseLibrary from "./CoachExerciseLibrary";
import CoachClientProfile from "./CoachClientProfile";
import CoachClients from "./CoachClients";
import CoachForms from "./CoachForms";
import CoachTutorials from "./CoachTutorials";
import { Avatar } from "./coachShared";

/* Far-left icon rail (Everfit-style). Sections map to our coach features. */
const RAIL = [
    { key: "clients", label: "Clients", icon: "ti-users", to: "/coach" },
    { key: "library", label: "Exercise library", icon: "ti-barbell", to: "/coach/library" },
    { key: "forms", label: "Forms", icon: "ti-clipboard-text", to: "/coach/forms" },
    { key: "tutorials", label: "Tutorials", icon: "ti-school", to: "/coach/tutorials" },
    { key: "metrics", label: "Metrics", icon: "ti-chart-line", to: "/coach/metrics" },
];

function IconRail({ active }) {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [hover, setHover] = useState(null);
    const btn = (on) => ({
        position: "relative", width: 42, height: 42, borderRadius: 11, border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        background: on ? "var(--cc-accent-bg)" : "transparent", color: on ? "var(--cc-accent)" : "var(--cc-text2)",
    });
    return (
        <nav style={{ width: 64, flexShrink: 0, background: "var(--cc-page)", borderRight: "1px solid var(--cc-border)", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--cc-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, marginBottom: 10 }}>L</div>
            {RAIL.map((it) => (
                <div key={it.key} style={{ position: "relative" }} onMouseEnter={() => setHover(it.key)} onMouseLeave={() => setHover(null)}>
                    <button type="button" aria-label={it.label} onClick={() => navigate(it.to)} style={btn(active === it.key)}>
                        <i className={`ti ${it.icon}`} aria-hidden="true" />
                    </button>
                    {hover === it.key ? (
                        <span style={{ position: "absolute", left: 50, top: 9, whiteSpace: "nowrap", background: "var(--cc-panel)", border: "1px solid var(--cc-border)", color: "var(--cc-text)", fontSize: 12, fontWeight: 600, padding: "5px 9px", borderRadius: 7, zIndex: 50, pointerEvents: "none" }}>{it.label}</span>
                    ) : null}
                </div>
            ))}
            <div style={{ flex: 1 }} />
            <Avatar name={`${user?.first_name || ""} ${user?.last_name || ""}`} size={34} />
            <button type="button" aria-label="Log out" onClick={logout} style={{ ...btn(false), fontSize: 18 }}><i className="ti ti-logout" aria-hidden="true" /></button>
        </nav>
    );
}

function SectionShell({ children }) {
    return <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>{children}</div>;
}

const CoachConsole = ({ section = "clients" }) => {
    const { token } = useAuth();
    const { clientId } = useParams();

    return (
        <div className="cc-root" data-theme="dark" style={{ minHeight: "100vh", background: "var(--cc-page)", color: "var(--cc-text)", padding: 14, boxSizing: "border-box" }}>
            <div style={{ display: "flex", height: "calc(100vh - 28px)", background: "var(--cc-surface)", border: "1px solid var(--cc-border)", borderRadius: 16, overflow: "hidden" }}>
                <IconRail active={section} />
                {section === "clients" && clientId ? <CoachClientProfile token={token} clientId={Number(clientId)} /> : null}
                {section === "clients" && !clientId ? <CoachClients token={token} /> : null}
                {section === "library" ? <SectionShell><CoachExerciseLibrary token={token} /></SectionShell> : null}
                {section === "forms" ? <SectionShell><CoachForms token={token} /></SectionShell> : null}
                {section === "tutorials" ? <SectionShell><CoachTutorials token={token} /></SectionShell> : null}
                {section === "metrics" ? <SectionShell><MetricsSection /></SectionShell> : null}
            </div>
        </div>
    );
};

function MetricsSection() {
    return (
        <main style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--cc-text)" }}>Metrics</h1>
            <div style={{ background: "var(--cc-panel)", border: "1px solid var(--cc-border)", borderRadius: 14, padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--cc-accent-bg)", color: "var(--cc-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}><i className="ti ti-chart-line" aria-hidden="true" /></div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--cc-text)" }}>Per-client metrics are live</div>
                    <div style={{ fontSize: 13, color: "var(--cc-text2)", marginTop: 2, lineHeight: 1.5 }}>Open any client and use the <strong>Metrics</strong> tab for body measurements + exercise progression.</div>
                </div>
            </div>
        </main>
    );
}

export default CoachConsole;
