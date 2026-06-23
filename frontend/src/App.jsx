import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Spending from "./pages/Spending";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Placeholder from "./pages/Placeholder";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/investment" element={<Placeholder title="Investment" icon="▲" />} />
          <Route path="/planning" element={<Placeholder title="Financial Planning" icon="◇" />} />
          <Route path="/subscriptions" element={<Placeholder title="Subscriptions" icon="↻" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
