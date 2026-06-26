import { NavLink } from "react-router-dom";

export const NAV = {
  main: [
    { to: "/dashboard", label: "Dashboard", icon: "▦" },
    { to: "/spending", label: "Spending", icon: "◎" },
    // { to: "/report", label: "Report", icon: "▤" },
    { to: "/investment", label: "Investment", icon: "▲" },
  ],
  manage: [
    { to: "/budget", label: "Budget", icon: "◇" },
    { to: "/import", label: "Import Statement", icon: "↥" },
    { to: "/settings", label: "Settings", icon: "⚙" },
  ],
};

function Links({ items }) {
  return (
    <nav className="sidebar-nav">
      {items.map(({ to, label, icon, soon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `side-link${isActive ? " active" : ""}${soon ? " soon" : ""}`}
        >
          <span className="ico">{icon}</span>
          <span>{label}</span>
          {soon && <span className="soon-tag">SOON</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">FT</div>
        <div className="brand-name">Finance Tracker</div>
      </div>
      {/* <div className="sidebar-search">
        <span>⌕</span>
        <span>Search</span>
      </div> */}

      <div className="sidebar-section">MAIN MENU</div>
      <Links items={NAV.main} />

      <div className="sidebar-section mt">MANAGEMENT</div>
      <Links items={NAV.manage} />
    </aside>
  );
}
