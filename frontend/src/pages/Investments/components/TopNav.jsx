import { NavLink } from "react-router-dom";

// Shared top nav for the investment shell: brand, page tabs, and a
// per-page right-side slot (search / +Trade / ticker chip) registered by
// leaf pages via the layout's Outlet context.
export default function TopNav({ navExtra }) {
  return (
    <div className="invest-topnav">
      <span className="invest-brand">▣ Markets</span>
      <div className="invest-tabs">
        <NavLink to="/investment" end
          className={({ isActive }) => `invest-tab${isActive ? " is-active" : ""}`}>
          Portfolio
        </NavLink>
        <NavLink to="/investment/news"
          className={({ isActive }) => `invest-tab${isActive ? " is-active" : ""}`}>
          Market News
        </NavLink>
      </div>
      <div className="invest-navextra">{navExtra}</div>
    </div>
  );
}
