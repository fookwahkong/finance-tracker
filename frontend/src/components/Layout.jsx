import { Outlet, useLocation } from "react-router-dom";
import Sidebar, { NAV } from "./Sidebar";

const TITLES = [...NAV.main, ...NAV.manage].reduce(
  (acc, { to, label }) => ({ ...acc, [to]: to === "/dashboard" ? "Overview" : label }),
  {}
);

export default function Layout() {
  const { pathname } = useLocation();
  const title = TITLES[pathname] || "Overview";

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <header className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="topbar-user">
            <div className="avatar">IK</div>
            <div>
              <div className="user-name">Ivan Kong</div>
              <div className="user-mail">kongivan2@gmail.com</div>
            </div>
          </div>
        </header>
        <div className="page fade-in" key={pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
