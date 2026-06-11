import { useEffect, useState } from "react";
import { getTransactions, createTransaction, getCategories } from "../api/client";
import TransactionTable from "../components/TransactionTable";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  item: "",
  category: "",
  amount: "",
  source: "",
  remarks: "",
};

export default function Transactions() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  function load() {
    getTransactions(month).then(setTransactions).catch(() => {});
  }

  useEffect(() => { load(); }, [month]);
  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createTransaction({ ...form, amount: Number(form.amount) });
      setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
      setAdding(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { key: "date",    label: "Date",    type: "date",   required: true },
    { key: "item",    label: "Item",    type: "text",   required: true,  placeholder: "Coffee, Salary…" },
    { key: "amount",  label: "Amount",  type: "number", required: true,  placeholder: "−50 or +1000",  step: "0.01" },
    { key: "source",  label: "Source",  type: "text",   required: false, placeholder: "Bank, Cash…" },
    { key: "remarks", label: "Remarks", type: "text",   required: false, placeholder: "Optional note" },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="form-input"
          style={{ width: "auto" }}
          aria-label="Select month"
        />
        <button
          className={`btn ${adding ? "btn-secondary" : "btn-primary"}`}
          onClick={() => setAdding(!adding)}
          style={{ marginLeft: "auto", cursor: "pointer" }}
        >
          {adding ? (
            "Cancel"
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Transaction
            </>
          )}
        </button>
      </div>

      {adding && (
        <div className="card slide-down" style={{ marginBottom: "1.5rem" }}>
          <p className="section-title">Add Transaction</p>
          <form onSubmit={handleAdd}>
            <div className="form-grid">
              {fields.map(({ key, label, type, required, placeholder, step }) => (
                <div key={key} className="form-group">
                  <label className="form-label" htmlFor={`tx-${key}`}>{label}</label>
                  <input
                    id={`tx-${key}`}
                    className="form-input"
                    type={type}
                    step={step}
                    required={required}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}

              <div className="form-group">
                <label className="form-label" htmlFor="tx-category">Category</label>
                <select
                  id="tx-category"
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  <option value="">— none —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ justifyContent: "flex-end" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ cursor: "pointer", width: "100%" }}
                >
                  {saving ? "Saving…" : "Save Transaction"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <TransactionTable transactions={transactions} onRefresh={load} />
      </div>
    </div>
  );
}
