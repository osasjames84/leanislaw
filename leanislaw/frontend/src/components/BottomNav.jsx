import { NavLink } from "react-router-dom";
import ChadPhoto from "../assets/creator_photo.png";

const bar = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-around",
    gap: 4,
    padding: "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))",
    backgroundColor: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderTop: "0.5px solid #d1d1d6",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.06)",
};

const itemBase = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    padding: "6px 4px",
    borderRadius: 12,
    textDecoration: "none",
    fontSize: "0.56rem",
    fontWeight: "700",
    color: "#8e8e93",
    transition: "color 0.15s, background-color 0.15s",
};

const icon = { fontSize: "1.35rem", lineHeight: 1 };
const iconImg = {
    width: 22,
    height: 22,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #d1d1d6",
};

const tabs = [
    { to: "/leaderboard", label: "Leaderboard", emoji: "🏆" },
    { to: "/macros", label: "Macros", emoji: "🥗" },
    { to: "/chat", label: "Chats", image: ChadPhoto },
    { to: "/workout", label: "Workout", emoji: "💪" },
];

const BottomNav = () => (
    <nav style={bar} aria-label="Main navigation">
        {tabs.map(({ to, label, emoji, image }) => (
            <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                    ...itemBase,
                    color: isActive ? "#007aff" : "#636366",
                    backgroundColor: isActive ? "rgba(0, 122, 255, 0.1)" : "transparent",
                })}
                end={to !== "/chat" && to !== "/workout"}
            >
                {image ? (
                    <img src={image} alt="" aria-hidden style={iconImg} />
                ) : (
                    <span style={icon} aria-hidden>
                        {emoji}
                    </span>
                )}
                <span>{label}</span>
            </NavLink>
        ))}
    </nav>
);

export default BottomNav;
