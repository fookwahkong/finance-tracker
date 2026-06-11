import { useEffect, useState } from "react";
import { getCategories, createCategory, deleteCategory } from "../api/client";

export default function Settings() {
  const [categories, setCategories] = useState([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    getCategories().then(setCategories).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createCategory(newName.trim());
      setNewName("");
      setError("");
      load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to add category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat) {
    if (window.confirm(`Delete category "${cat.name}"?`)) {
      await deleteCategory(cat.id);
      load();
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your transaction categories</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <p className="section-title">Categories</p>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.625rem", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1 }}>
            <input
              id="new-cat"
              type="text"
              className="form-input"
              placeholder="New category name…"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setError(""); }}
              aria-label="New category name"
            />
            {error && (
              <p style={{ color: "var(--red)", fontSize: "0.75rem", marginTop: "0.375rem" }}>{error}</p>
            )}
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !newName.trim()}
            style={{ cursor: "pointer", flexShrink: 0 }}
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </form>

        {categories.length === 0 ? (
          <div className="empty-state" style={{ padding: "1.5rem 0" }}>
            No categories yet. Add one above.
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {categories.map((cat, i) => (
              <li
                key={cat.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.6875rem 0",
                  borderBottom: i < categories.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                  <span className="chip">{cat.name}</span>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(cat)}
                  aria-label={`Delete ${cat.name}`}
                  style={{ cursor: "pointer" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
