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
    <section className="card" style={{ maxWidth: 560 }}>
      <div className="card-head"><div className="card-title">Categories</div></div>

      <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <input
            className="input"
            type="text"
            placeholder="New category name…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setError(""); }}
            aria-label="New category name"
          />
          {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 6 }}>{error}</p>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving || !newName.trim()}>
          {saving ? "Adding…" : "Add"}
        </button>
      </form>

      {categories.length === 0 ? (
        <div className="empty">No categories yet. Add one above.</div>
      ) : (
        categories.map((cat) => (
          <div className="row" key={cat.id}>
            <span className="chip">{cat.name}</span>
            <button className="btn btn-danger btn-sm" style={{ marginLeft: "auto" }} onClick={() => handleDelete(cat)} aria-label={`Delete ${cat.name}`}>
              Delete
            </button>
          </div>
        ))
      )}
    </section>
  );
}
