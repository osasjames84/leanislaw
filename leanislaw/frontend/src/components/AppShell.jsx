import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";

const wrap = {
    minHeight: "100vh",
    boxSizing: "border-box",
    paddingBottom: "calc(62px + env(safe-area-inset-bottom, 0px))",
};

const AppShell = () => (
    <div style={wrap}>
        <Outlet />
        <BottomNav />
    </div>
);

export default AppShell;
