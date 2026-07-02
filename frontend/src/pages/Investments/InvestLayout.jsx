import { Outlet } from "react-router-dom";
import WatchlistSidebar from "./components/WatchlistSidebar";

export default function InvestLayout() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}><Outlet /></div>
      <WatchlistSidebar />
    </div>
  );
}
