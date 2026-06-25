import { useEffect, useState } from "react";
import { parseStatement, importStatement, getCategories } from "../api/client";

export default function Import() {
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setError(""); setDone("");
    try {
      const data = await parseStatement(file);
      setRows(data.rows.map((r) => ({
        ...r,
        category: r.suggested_category || "",
        include: true,
      })));
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to parse statement.");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  function update(i, field, value) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function onImport() {
    setBusy(true); setError(""); setDone("");
    const payload = rows
      .filter((r) => r.include)
      .map(({ date, item, amount, source, category }) => ({
        date, item, amount, source, category: category || null,
      }));
    try {
      const res = await importStatement(payload);
      setDone(`Imported ${res.inserted} transactions.`);
      setRows([]);
    } catch (err) {
      setError(err.response?.data?.detail || "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  const knownNames = new Set(categories.map((c) => c.name));
  const selectedCount = rows.filter((r) => r.include).length;

  return (
    <div className="page">
      <h1>Import Statement</h1>
      <p>Upload a digital DBS/POSB PDF statement to extract transactions.</p>

      <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} />
      {busy && <p>Working…</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {done && <p style={{ color: "green" }}>{done}</p>}

      {rows.length > 0 && (
        <>
          <table className="import-table">
            <thead>
              <tr>
                <th>Include</th><th>Date</th><th>Item</th>
                <th>Amount</th><th>Source</th><th>Category</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input type="checkbox" checked={r.include}
                      onChange={(e) => update(i, "include", e.target.checked)} />
                  </td>
                  <td>{r.date}</td>
                  <td>
                    <input value={r.item} onChange={(e) => update(i, "item", e.target.value)} />
                  </td>
                  <td style={{ color: r.amount < 0 ? "crimson" : "green" }}>
                    {r.amount.toFixed(2)}
                  </td>
                  <td>{r.source || "—"}</td>
                  <td>
                    <input list="cat-options" value={r.category}
                      onChange={(e) => update(i, "category", e.target.value)} />
                    {r.category && !knownNames.has(r.category) && (
                      <span className="new-cat-tag"> NEW</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="cat-options">
            {categories.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
          <button onClick={onImport} disabled={busy}>
            Import {selectedCount} selected
          </button>
        </>
      )}
    </div>
  );
}
