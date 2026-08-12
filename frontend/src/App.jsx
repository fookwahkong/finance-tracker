import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { useAuth } from "./auth/AuthContext";
import Dashboard from "./pages/Dashboard";
import Spending from "./pages/Spending";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import Budget from "./pages/Budget";
import Investments from "./pages/Investments";
import StockRoute from "./pages/Investments/StockRoute";

export default function App() {
  const { session, loading } = useAuth();

  if (loading) return null;
  if (!session) return <Login />;

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/spending" element={<Spending />} />
            <Route path="/import" element={<Import />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/investment" element={<Investments />} />
            <Route path="/investment/stock/:symbol" element={<StockRoute />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
