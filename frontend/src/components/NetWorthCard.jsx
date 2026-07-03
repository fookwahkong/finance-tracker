import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { getNetWorth, upsertNetWorth, deleteNetWorth } from "../api/client";
import { getFxUsdSgd } from "../api/investments";
import { cashForMonth, netFlowMap } from "../lib/aggregate";
import { money, currentMonth, monthLabel } from "../lib/format";
import { usePortfolioValue } from "../pages/Investments/hooks/usePortfolioValue";

export default function NetWorthCard({ transactions }) {
  const [month, setMonth] = useState(currentMonth());
  const [anchors, setAnchors] = useState([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Whether the selected month already has a saved anchor (enables removal).
  const hasAnchor = anchors.some((a) => a.month === month);

  function load() {
    getNetWorth().then(setAnchors).catch(() => setAnchors([]));
  }
  useEffect(() => { load(); }, []);

  // Precompute the month->net-flow map once per transaction list, so changing
  // the selected month is just O(1) lookups rather than a full rescan.
  const flowMap = useMemo(() => netFlowMap(transactions), [transactions]);
  const cash = useMemo(
    () => cashForMonth(anchors, flowMap, month),
    [anchors, flowMap, month],
  );

  const { valueUsd } = usePortfolioValue();
  const [fxRate, setFxRate] = useState(null);
  useEffect(() => { getFxUsdSgd().then((fx) => setFxRate(fx.rate)).catch(() => {}); }, []);
  const investmentSgd = valueUsd != null && fxRate != null ? valueUsd * fxRate : null;
  // Show the raw USD portfolio value as soon as it's known, rather than a
  // "—" while the FX rate is still loading.
  const investment = investmentSgd ?? valueUsd;

  const netWorth = (cash || 0) + (investment || 0);

  function openCash() {
    const existing = anchors.find((a) => a.month === month);
    setDraft(existing ? String(existing.cash) : "");
    setOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const amount = Number(draft);
    if (draft.trim() === "" || Number.isNaN(amount)) return;
    setSaving(true);
    try {
      await upsertNetWorth(month, amount);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await deleteNetWorth(month);
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-sub">Net Worth</div>
        <input
          className="input"
          type="month"
          style={{ width: "auto", marginLeft: "auto" }}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
        <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-1px" }}>{money(netWorth)}</div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{monthLabel(month)}</div>
      </div>
      <div className="networth-split" style={{ display: "grid", gap: 14 }}>
        <button
          type="button"
          onClick={openCash}
          style={{ textAlign: "left", background: "#f6f8f8", borderRadius: 14, padding: 16, border: "none", cursor: "pointer" }}
        >
          <div className="stat-label">Cash</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{cash === null ? "—" : (cash < 0 ? "-": "") + money(cash)}</div>
          <div style={{ fontSize: 14, color: "var(--muted-2)", marginTop: 4 }}>Tap to set this month</div>
        </button>
        <Link
          to="/investment"
          style={{ textAlign: "left", background: "#f6f8f8", borderRadius: 14, padding: 16, textDecoration: "none", color: "inherit", display: "block" }}
        >
          <div className="stat-label">Investment</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{investment == null ? "—" : money(investment)}</div>
          <div style={{ fontSize: 14, color: "var(--muted-2)", marginTop: 4 }}>
            {investmentSgd != null ? "USD holdings × daily SGD rate" : "USD holdings (converting…)"} {`(1 USD = ${fxRate} SGD)`}
          </div>
        </Link>
      </div>

      {open && createPortal(
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setOpen(false)}>
          <div className="modal-panel" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Cash for {monthLabel(month)}</div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={() => setOpen(false)} disabled={saving}>x</button>
            </div>
            <form onSubmit={save}>
              <div className="field">
                <label className="field-label">Cash balance</label>
                <input className="input" type="number" step="0.01" required autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
              </div>
              <div className="modal-actions">
                {hasAnchor && (
                  <button type="button" className="btn btn-ghost" style={{ marginRight: "auto", color: "var(--red)" }} onClick={remove} disabled={saving}>
                    Remove anchor
                  </button>
                )}
                <button type="button" className="btn btn-outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
