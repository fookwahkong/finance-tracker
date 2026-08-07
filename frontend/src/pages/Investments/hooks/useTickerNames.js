import { useEffect, useState } from "react";
import { getTicker } from "../../../api/investments";

// Display names for a set of symbols → { GOOGL: "Alphabet Inc Class A" }.
// Polygon ticker details, server-cached 24h. A symbol that fails to resolve is
// simply left out, so one dead ticker never blanks the rest of the list.
// Names don't change, so this fetches once per membership change — no polling.
export function useTickerNames(symbols) {
  const [names, setNames] = useState({});
  const key = [...new Set(symbols)].sort().join(",");

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    key.split(",").forEach((s) => {
      getTicker(s)
        .then((d) => {
          const name = d?.results?.name;
          if (alive && name) setNames((prev) => ({ ...prev, [s]: name }));
        })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [key]);

  return names;
}
