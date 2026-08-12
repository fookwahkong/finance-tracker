import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { sendAgentChat } from "../api/agent";

export default function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const result = await sendAgentChat(text, history);
      setHistory(result.history);
      setMessages((m) => [...m, { role: "assistant", text: result.reply }]);
    } catch (err) {
      const rateLimited = err.status === 429;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: rateLimited ? "Rate limited — try again tomorrow." : "Something went wrong. Try again.",
          kind: rateLimited ? "rate-limited" : "error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="assistant-widget">
      <button
        type="button"
        className="assistant-bubble"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "✕" : "💬"}
      </button>
      {open && (
        <div className="assistant-panel" role="dialog" aria-label="Finance assistant">
          <div className="assistant-messages">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`assistant-msg assistant-msg-${m.role}${m.kind ? ` assistant-msg-${m.kind}` : ""}`}
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                ) : (
                  m.text
                )}
              </div>
            ))}
            {loading && <div className="assistant-msg assistant-msg-assistant assistant-msg-loading">…</div>}
          </div>
          <form className="assistant-input-row" onSubmit={send}>
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances…"
              disabled={loading}
            />
            <button type="submit" className="btn" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
