import { useState } from "react";
import { updateTransaction, deleteTransaction } from "../api/client";

function fmt(n) {
  return Math.abs(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COLS = ["Date", "Item", "Category", "Amount", "Source", "Remarks", ""];

export default function TransactionTable({ transactions, onRefresh }) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});

  function startEdit(tx) {
    setEditId(tx.id);
    setEditData({
      item: tx.item,
      amount: tx.amount,
      category: tx.category || "",
      source: tx.source || "",
      remarks: tx.remarks || "",
    });
  }

  async function saveEdit(id) {
    await updateTransaction(id, { ...editData, amount: Number(editData.amount) });
    setEditId(null);
    onRefresh();
  }

  async function handleDelete(id) {
    if (window.confirm("Delete this transaction?")) {
      await deleteTransaction(id);
      onRefresh();
    }
  }

  if (transactions.length === 0) {
    return <div className="empty-state">No transactions found.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {COLS.map((h) => <th key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) =>
            editId === tx.id ? (
              <tr key={tx.id}>
                <td style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{tx.date}</td>
                {["item", "category", "amount", "source", "remarks"].map((f) => (
                  <td key={f}>
                    <input
                      className="edit-input"
                      type={f === "amount" ? "number" : "text"}
                      step={f === "amount" ? "0.01" : undefined}
                      value={editData[f]}
                      onChange={(e) => setEditData({ ...editData, [f]: e.target.value })}
                    />
                  </td>
                ))}
                <td>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(tx.id)}>Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={tx.id}>
                <td style={{ color: "var(--text-3)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>{tx.date}</td>
                <td style={{ fontWeight: 500 }}>{tx.item}</td>
                <td>{tx.category ? <span className="chip">{tx.category}</span> : <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                <td>
                  <span className={tx.amount < 0 ? "amount-neg" : "amount-pos"}>
                    {tx.amount > 0 ? "+" : "−"}{fmt(Math.abs(tx.amount))}
                  </span>
                </td>
                <td style={{ color: "var(--text-2)" }}>{tx.source || <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                <td style={{ color: "var(--text-2)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tx.remarks || <span style={{ color: "var(--text-3)" }}>—</span>}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(tx)}
                      aria-label="Edit transaction"
                      style={{ cursor: "pointer" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(tx.id)}
                      aria-label="Delete transaction"
                      style={{ cursor: "pointer" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
