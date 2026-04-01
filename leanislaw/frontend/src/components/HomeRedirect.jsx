import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const HomeRedirect = () => {
    const { token, user, loading } = useAuth();
    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: "center", color: "#8e8e93" }}>
                Loading…
            </div>
        );
    }
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    if (user?.role === "coach") {
        return <Navigate to="/coach" replace />;
    }
    if (user && user.tdee_onboarding_done === false) {
        return <Navigate to="/setup/tdee" replace />;
    }
    return <Navigate to="/dashboard" replace />;
};

export default HomeRedirect;
