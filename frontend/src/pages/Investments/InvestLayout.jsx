import { useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./components/TopNav";
import WatchlistSidebar from "./components/WatchlistSidebar";

export default function InvestLayout() {
  // Leaf pages register their right-side nav content here via Outlet context.
  const [navExtra, setNavExtra] = useState(null);
  return (
    <div className="card invest-shell">
      <TopNav navExtra={navExtra} />
      <div className="invest-body">
        <WatchlistSidebar />
        <div className="invest-main">
          <Outlet context={setNavExtra} />
        </div>
      </div>
    </div>
  );
}
