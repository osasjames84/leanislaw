import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/** Only users with role coach (from /me). */
const CoachRoute = ({ children }) => {
    const { user, loading, token } = useAuth();

    if (loading || (token && !user)) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "#8e8e93" }}>Loading…</div>
        );
    }

    if (!token) {
        return <Navigate to="/login?coach=1" replace />;
    }

    if (user?.role !== "coach") {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default CoachRoute;
