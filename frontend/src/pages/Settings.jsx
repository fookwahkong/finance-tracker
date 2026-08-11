import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCategories, createCategory, deleteCategory } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { useAuth } from "../auth/AuthContext";

export default function Settings() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategories,
  });
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await createCategory(newName.trim());
      setNewName("");
      setError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to add category.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat) {
    if (window.confirm(`Delete category "${cat.name}"?`)) {
      await deleteCategory(cat.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    }
  }

  return (
    <>
    <section className="card" style={{ maxWidth: 560 }}>
      <div className="card-head"><div className="card-title">Account</div></div>
      <button type="button" className="btn btn-outline" onClick={signOut}>
        Sign out
      </button>
    </section>

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
    </>
  );
}
