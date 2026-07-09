import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parseStatement, importStatement, getCategories } from "../api/client";
import { signed } from "../lib/format";

const SOURCE_LABELS = {
  cash: "Cash", paynow: "PayNow", paylah: "PayLah", card: "Card", giro: "GIRO",
};
const sourceLabel = (s) => SOURCE_LABELS[s] || s;

export default function Import() {
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  const knownNames = useMemo(() => new Set(categories.map((c) => c.name)), [categories]);

  // Full dropdown list: existing categories plus any new ones the LLM proposed
  // (or the user typed) across the parsed rows.
  const categoryOptions = useMemo(() => {
    const names = new Set(categories.map((c) => c.name));
    rows.forEach((r) => { if (r.category) names.add(r.category); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories, rows]);

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true); setError(""); setDone("");
    try {
      const data = await parseStatement(file);
      setRows(data.rows.map((r) => ({
        ...r,
        category: r.suggested_category || "",
        include: true,
      })));
    } catch (err) {
      setError(
        err.status === 429
          ? err.message
          : err.message || "Failed to parse statement."
      );
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  function update(i, field, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function clearAll() {
    setRows([]); setFileName(""); setError(""); setDone("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onImport() {
    setBusy(true); setImporting(true); setError(""); setDone("");
    const payload = rows
      .filter((r) => r.include)
      .map(({ date, item, amount, source, category }) => ({
        date, item, amount, source, category: category || null,
      }));
    try {
      const res = await importStatement(payload);
      setDone(`Imported ${res.inserted} transactions.`);
      clearAll();
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed.");
    } finally {
      setBusy(false); setImporting(false);
    }
  }

  const included = rows.filter((r) => r.include);
  const selectedCount = included.length;
  const newCatCount = new Set(
    included.map((r) => r.category).filter((c) => c && !knownNames.has(c))
  ).size;
  const net = included.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      {/* Upload */}
      <section className="card">
        <div className="card-head">
          <div className="card-title">Import Statement</div>
        </div>
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 14 }}>
          Upload a digital DBS/POSB PDF statement to extract transactions, review them, and import.
        </p>
        {error && <div className="form-error" role="alert">{error}</div>}
        {done && <div className="form-ok" role="status">{done}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="btn btn-outline" style={{ cursor: busy ? "default" : "pointer" }}>
            {busy ? "Working…" : "Choose PDF"}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={onFile}
              disabled={busy}
              style={{ display: "none" }}
            />
          </label>
          {fileName && <span className="row-sub">{fileName}</span>}
          {rows.length > 0 && (
            <button type="button" className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={clearAll} disabled={busy}>
              Clear
            </button>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid-4">
            <div className="stat">
              <div className="stat-label">Rows Found</div>
              <div className="stat-value">{rows.length}</div>
              <div className="stat-note">Parsed from statement</div>
            </div>
            <div className="stat accent">
              <div className="stat-label">Selected</div>
              <div className="stat-value">{selectedCount}</div>
              <div className="stat-note">Will be imported</div>
            </div>
            <div className="stat">
              <div className="stat-label">New Categories</div>
              <div className="stat-value">{newCatCount}</div>
              <div className="stat-note">Created on import</div>
            </div>
            <div className="stat">
              <div className="stat-label">Net</div>
              <div className="stat-value">{signed(net)}</div>
              <div className="stat-note">Selected rows</div>
            </div>
          </div>

          {/* Review table */}
          <section className="card">
            <div className="card-head">
              <div className="card-title">Review Transactions</div>
              <span className="pill" style={{ marginLeft: "auto" }}>{selectedCount} of {rows.length} selected</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Date</th>
                  <th>Item</th>
                  <th>Source</th>
                  <th>Category</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const income = r.amount > 0;
                  const isNew = r.category && !knownNames.has(r.category);
                  return (
                    <tr key={i} style={{ opacity: r.include ? 1 : 0.45 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => update(i, "include", e.target.checked)}
                        />
                      </td>
                      <td style={{ color: "var(--muted)" }}>{r.date}</td>
                      <td>
                        <input
                          className="input"
                          value={r.item}
                          onChange={(e) => update(i, "item", e.target.value)}
                        />
                      </td>
                      <td>{r.source ? <span className="chip">{sourceLabel(r.source)}</span> : <span className="row-sub">—</span>}</td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <select
                            className="select"
                            value={r.category}
                            onChange={(e) => update(i, "category", e.target.value)}
                          >
                            <option value="">Uncategorized</option>
                            {categoryOptions.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          {isNew && <span className="chip">NEW</span>}
                        </span>
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: income ? "var(--green)" : "var(--ink)" }}>
                        {signed(r.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={clearAll} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={onImport} disabled={busy || selectedCount === 0}>
                {busy ? "Importing…" : `Import ${selectedCount} selected`}
              </button>
            </div>
          </section>
        </>
      )}

      {importing && createPortal(
        <div className="loading-overlay" role="alert" aria-busy="true">
          <div className="spinner" />
        </div>,
        document.body
      )}
    </>
  );
}
