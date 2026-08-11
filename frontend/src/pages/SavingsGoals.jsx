import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addSavingContribution, createSavingGoal, getSavings, syncSavings, upsertSavingProfile } from "../api/client";
import { queryKeys } from "../api/queryKeys";
import { money } from "../lib/format";

export default function SavingsGoals() {
  const client = useQueryClient();
  const [profile, setProfile] = useState({ salary: "", payday: "" });
  const [goal, setGoal] = useState({ name: "", target_amount: "", allocation_percentage: "" });
  const [extra, setExtra] = useState({});
  const [error, setError] = useState("");
  const { data = { goals: [], contributions: [] } } = useQuery({ queryKey: queryKeys.savings, queryFn: getSavings });

  useEffect(() => { syncSavings().then(() => client.invalidateQueries({ queryKey: queryKeys.savings })).catch(() => {}); }, [client]);
  useEffect(() => { if (data.profile) setProfile({ salary: data.profile.salary, payday: data.profile.payday }); }, [data.profile]);
  const total = useMemo(() => data.goals.reduce((sum, item) => sum + Number(item.allocation_percentage), 0), [data.goals]);
  const refresh = () => client.invalidateQueries({ queryKey: queryKeys.savings });
  const savedFor = (id) => data.contributions.filter((c) => c.goal_id === id).reduce((sum, c) => sum + Number(c.amount), 0);

  async function saveProfile(e) { e.preventDefault(); setError(""); try { await upsertSavingProfile({ salary: Number(profile.salary), payday: Number(profile.payday) }); await syncSavings(); refresh(); } catch (err) { setError(err.response?.data?.detail || "Could not save salary settings."); } }
  async function addGoal(e) { e.preventDefault(); setError(""); const percent = Number(goal.allocation_percentage); if (total + percent > 100) return setError("All savings-goal allocations together cannot exceed 100%."); try { await createSavingGoal({ ...goal, target_amount: Number(goal.target_amount), allocation_percentage: percent }); setGoal({ name: "", target_amount: "", allocation_percentage: "" }); await syncSavings(); refresh(); } catch (err) { setError(err.response?.data?.detail || "Could not create savings goal."); } }
  async function addExtra(id) { const amount = Number(extra[id]); if (!amount) return; try { await addSavingContribution(id, amount); setExtra((old) => ({ ...old, [id]: "" })); refresh(); } catch (err) { setError(err.response?.data?.detail || "Could not add extra cash."); } }

  return <div style={{ display: "grid", gap: 16 }}>
    <section className="card"><div className="card-head"><div className="card-title">Monthly salary</div></div><form onSubmit={saveProfile} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><input className="input" type="number" min="0" required placeholder="Salary amount" value={profile.salary} onChange={(e) => setProfile({ ...profile, salary: e.target.value })} /><input className="input" type="number" min="1" max="31" required placeholder="Payday (1–31)" value={profile.payday} onChange={(e) => setProfile({ ...profile, payday: e.target.value })} /><button className="btn" type="submit">Save salary</button></form></section>
    <section className="card"><div className="card-head"><div className="card-title">Add savings goal</div><span className={`status-badge ${total > 100 ? "status-over" : "status-on"}`}>{total}% allocated</span></div><form onSubmit={addGoal} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><input className="input" required placeholder="Goal name" value={goal.name} onChange={(e) => setGoal({ ...goal, name: e.target.value })} /><input className="input" type="number" min="1" required placeholder="Target amount" value={goal.target_amount} onChange={(e) => setGoal({ ...goal, target_amount: e.target.value })} /><input className="input" type="number" min="0" max="100" required placeholder="Salary %" value={goal.allocation_percentage} onChange={(e) => setGoal({ ...goal, allocation_percentage: e.target.value })} /><button className="btn" type="submit">Add goal</button></form>{error && <p className="neg">{error}</p>}</section>
    <div className="grid-3">{data.goals.map((item) => { const saved = savedFor(item.id); const progress = Math.min(100, saved / Number(item.target_amount) * 100); const monthly = Number(profile.salary || 0) * Number(item.allocation_percentage) / 100; return <section className="card" key={item.id}><div className="card-title">{item.name}</div><div className="stat-value">{money(saved)} <span className="row-sub">/ {money(item.target_amount)}</span></div><div className="row-sub">{item.allocation_percentage}% · {money(monthly)}/month</div><div style={{ height: 8, background: "var(--line)", borderRadius: 8, margin: "14px 0" }}><div style={{ height: "100%", width: `${progress}%`, background: "var(--green)", borderRadius: 8 }} /></div><div style={{ display: "flex", gap: 8 }}><input className="input" type="number" min="0.01" placeholder="Extra cash" value={extra[item.id] || ""} onChange={(e) => setExtra({ ...extra, [item.id]: e.target.value })} /><button className="btn btn-outline btn-sm" type="button" disabled={progress >= 100} onClick={() => addExtra(item.id)}>Add</button></div></section>; })}</div>
  </div>;
}
