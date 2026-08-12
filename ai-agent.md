Here's the task list to hand off, grouped by phase:

**Phase 1 — read-only agent (MVP)**
- `db/003_agent.sql` — just the `agent_actions` table (logging only, no full history table)
- `core/agent/tools.py` — tool registry: `get_spending_summary`, `get_budget_status`, `get_savings_goal_progress`, `analyze_stock`, `get_portfolio_holdings`, each a thin wrapper over existing `core/` functions
- `core/agent/orchestrator.py` — the Claude tool-use loop (client-held history in, executes read tools inline, caps loop iterations, returns text + updated history)
- `backend/routers/agent.py` — `POST /api/agent/chat`
- Frontend chat tab — React state holds history, no persistence needed yet
- Test against your three original asks: spending, savings, stock pros/cons

**Phase 2 — write actions with confirmation**
- Add `mutates: True` tools: `create_budget`, `create_saving_goal`, `add_saving_contribution`
- Orchestrator: pause instead of executing when a `mutates` tool is called
- `POST /api/agent/confirm` — executes or declines, resumes the loop, writes to `agent_actions`
- Frontend confirm/reject proposal card
- Daily cap on confirmed writes

**Phase 3 — polish**
- Cap tool-loop iterations + daily agent LLM calls (extend your `ai_usage` pattern)
- "Not financial advice" caveat on investment-touching responses
- Optional: Telegram channel, since `core/agent` stays transport-agnostic like the rest of your business logicHand this task list to Claude Code with your repo open — it can work through the phases against your actual files and tests, rather than you copy-pasting code out of this chat.