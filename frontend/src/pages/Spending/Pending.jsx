import { money } from "../../lib/format";
import { receivedTotal, remaining } from "../../lib/claims";
import { settleClaim } from "../../api/claims";

export default function Pending({ claims, onChanged }) {
  // c is individual claim object in CLAIMS array
  const open = claims.filter((c) => c.status === "open");

  async function close(id) {
    if (!window.confirm("Mark this claim as all accounted for?")) return;
    // settleClaim will send a POST /api/claims/:id/settle 
    await settleClaim(id); 
    onChanged(); // trigger a reload for both transaction and claims
  }

  if (open.length === 0) {
    return (
      <section className="card">
        <div className="empty">Nothing pending - no one owes you right now.</div>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head"><div className="card-title">Who owes you</div></div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Who</th><th className="num">Owed</th><th className="num">Received</th><th className="num">Remaining</th><th></th>
          </tr>
        </thead>
        <tbody>
          {open.map((c) => {
            const links = c.links || [];
            return (
              <tr key={c.id}>
                <td><b>{c.counterparty || "Someone"}</b></td>
                <td className="num">{money(c.expected)}</td>
                <td className="num">{money(receivedTotal(links))}</td>
                <td className="num" style={{ fontWeight: 700 }}>{money(remaining(c.expected, links))}</td>
                {/* trigger close() function upon clicking */}
                <td className="num"><button type="button" className="btn btn-outline" onClick={() => close(c.id)}>Close</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
