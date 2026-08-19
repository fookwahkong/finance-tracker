import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTransactions, getCategories } from "../api/client";
import { getClaims } from "../api/claims";
import {
  createTravelGroup, deleteTravelGroup, getTravelGroups, updateTravelGroup,
} from "../api/travel";
import { queryKeys } from "../api/queryKeys";
import { linksForClaims } from "../lib/claims";
import TripPicker from "./Travel/TripPicker";
import TripDialog from "./Travel/TripDialog";
import TravelOverview from "./Travel/Overview";
import DaySummary from "./Travel/DaySummary";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "day", label: "Day Summary" },
];

export default function Travel() {
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(null);
  const [dialogFor, setDialogFor] = useState(null); // null | "new" | group
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const queryClient = useQueryClient();

  // The same three query keys the Spending tab uses. Sharing the cache is what
  // keeps the two tabs in sync: there is one copy of the transactions, so an
  // edit made in either place is immediately true in both.
  const { data: transactions = [] } = useQuery({
    queryKey: queryKeys.transactions(),
    queryFn: () => getTransactions(),
  });
  const { data: claims = [] } = useQuery({
    queryKey: queryKeys.claims,
    queryFn: () => getClaims(),
  });
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: getCategories,
  });
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: queryKeys.travelGroups,
    queryFn: getTravelGroups,
  });

  const claimLinks = useMemo(() => linksForClaims(claims), [claims]);

  // Derived, not synced: a selectedId that no longer matches a trip (it was
  // deleted, or the list loaded after mount) falls back to the first trip.
  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) || groups[0] || null,
    [groups, selectedId],
  );

  const reloadTransactions = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["monthlyReport"] });
  };
  const reloadClaims = () => queryClient.invalidateQueries({ queryKey: queryKeys.claims });
  const reloadGroups = () => queryClient.invalidateQueries({ queryKey: queryKeys.travelGroups });

  async function submitTrip(payload) {
    setSaving(true);
    setDialogError("");
    try {
      const saved = dialogFor === "new"
        ? await createTravelGroup(payload)
        : await updateTravelGroup(dialogFor.id, payload);
      setDialogFor(null);
      setSelectedId(saved.id);
      reloadGroups();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setDialogError(typeof detail === "string" ? detail : "Unable to save this trip.");
    } finally {
      setSaving(false);
    }
  }

  async function removeTrip(group) {
    const confirmed = window.confirm(
      `Delete the '${group.name}' trip? Your transactions stay in Spending — only the grouping is removed.`,
    );
    if (!confirmed) return;
    await deleteTravelGroup(group.id);
    setSelectedId(null);
    reloadGroups();
  }

  const shared = {
    group: selected,
    transactions,
    categories,
    claims,
    claimLinks,
    onChanged: reloadTransactions,
    reloadClaims,
    reloadGroups,
  };

  return (
    <>
      {groups.length > 0 && (
        <TripPicker
          groups={groups}
          transactions={transactions}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onNew={() => { setDialogFor("new"); setDialogError(""); }}
          onEdit={(group) => { setDialogFor(group); setDialogError(""); }}
          onDelete={removeTrip}
        />
      )}

      {groups.length === 0 && !groupsLoading && (
        <section className="card">
          <div className="empty">
            <div style={{ fontSize: 34, marginBottom: 10 }}>✈</div>
            <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>No trips yet</div>
            <div style={{ marginBottom: 18 }}>
              Create one and everything you spent between those dates lands here automatically.
            </div>
            <button type="button" className="btn btn-primary" onClick={() => { setDialogFor("new"); setDialogError(""); }}>
              + New trip
            </button>
          </div>
        </section>
      )}

      {selected && (
        <>
          <div className="tabbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab${tab === t.id ? " is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && <TravelOverview {...shared} />}
          {tab === "day" && <DaySummary {...shared} />}
        </>
      )}

      {dialogFor && (
        <TripDialog
          key={dialogFor === "new" ? "new" : dialogFor.id}
          group={dialogFor === "new" ? null : dialogFor}
          transactions={transactions}
          saving={saving}
          serverError={dialogError}
          onClose={() => !saving && setDialogFor(null)}
          onSubmit={submitTrip}
        />
      )}
    </>
  );
}
