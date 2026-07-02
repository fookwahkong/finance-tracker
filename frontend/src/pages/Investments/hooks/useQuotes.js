import { useEffect, useState } from "react";
import { getQuote } from "../../../api/investments";

const POLL_MS = 60_000; // free-tier guardrail: never faster than 60s

// Poll quotes for a set of symbols. Pauses while the tab is hidden
// (Page Visibility API) and refreshes immediately when it returns.
export function useQuotes(symbols) {
  const [quotes, setQuotes] = useState({});
  const key = [...new Set(symbols)].sort().join(",");

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;

    const tick = () => {
      key.split(",").forEach((s) => {
        getQuote(s)
          .then((q) => { if (alive) setQuotes((prev) => ({ ...prev, [s]: q })); })
          .catch(() => {}); // stale quote is better than a blank screen
      });
    };

    tick();
    const id = setInterval(() => { if (!document.hidden) tick(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [key]);

  return quotes;
}
