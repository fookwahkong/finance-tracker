import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Spending from "./pages/Spending";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import Import from "./pages/Import";
import Budget from "./pages/Budget";
import Investments from "./pages/Investments";
import StockRoute from "./pages/Investments/StockRoute";
import MarketNews from "./pages/Investments/MarketNews";
import InvestLayout from "./pages/Investments/InvestLayout";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/spending" element={<Spending />} />
            <Route path="/import" element={<Import />} />
            <Route path="/report" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
            <Route element={<InvestLayout />}>
              <Route path="/investment" element={<Investments />} />
              <Route path="/investment/news" element={<MarketNews />} />
              <Route path="/investment/stock/:symbol" element={<StockRoute />} />
            </Route>
            <Route path="/budget" element={<Budget />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
