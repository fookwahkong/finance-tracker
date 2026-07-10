# Design Decisions

The *why* behind the build. Each decision lists the options considered, the choice
made, and the trade-off accepted — because in an interview the reasoning matters
more than the result.

## Why Supabase Postgres?

**Considered:** a NoSQL store (MongoDB/Firestore), raw self-hosted Postgres, or a
managed Postgres with batteries included.

**Chose Supabase Postgres.** Financial data is inherently relational — transactions
belong to users, claims reference transactions, credits link claims to
transactions. A relational schema with foreign keys and `CHECK` constraints
expresses those rules directly and enforces correctness the app can't bypass.
Supabase adds two things I'd otherwise have to build: **authentication** and
**row-level security**, which together make the two-account isolation a
database-level guarantee rather than application discipline.

**Trade-off:** I'm tied to Supabase's platform conventions (its auth, its JWT
shape). For this project that coupling buys far more than it costs.

## Why a React SPA + FastAPI (two-tier), not Next.js?

**Considered:** a full-stack Next.js app (one framework, SSR, API routes) versus a
decoupled SPA + separate API.

**Chose a React + Vite SPA with a standalone FastAPI backend.** Two reasons. First,
the app is **behind a login and data-heavy** — it's an interactive dashboard, not
a content site that benefits from SSR/SEO, so the SPA model fits. Second — and more
importantly for a learning project — keeping the frontend and backend as separate
tiers forced me to design a **real HTTP contract** between them and let the backend
be **Python**, where the AI/parsing ecosystem and Pydantic validation are strongest.

**Trade-off:** two deployables to reason about and a bit of CORS/auth wiring that a
single Next.js app would hide. In return I got a clean transport boundary and a
Python domain layer.

## Why Vercel serverless?

**Considered:** a long-running server (Render/Railway/a VM) versus serverless
functions.

**Chose Vercel serverless.** It hosts the static frontend and the API from one
project and one `git push`, with cron built in — ideal for a personal-scale app
that's idle most of the time and costs nothing when unused.

**Trade-off:** serverless is **stateless and has cold starts**. That shaped the
architecture in concrete ways — no in-process background threads, so recurring work
became **cron endpoints**; no long-lived connections, so the Telegram bot became a
**webhook**. The constraint pushed the design toward statelessness, which is
cleaner anyway.

## Why webhooks instead of polling?

**Considered:** long-polling `getUpdates` in a loop versus a webhook.

**Chose a webhook.** On a serverless platform there's no always-on process to run a
polling loop, and polling wastes calls asking "anything new?" when usually there
isn't. A webhook does **zero work until a message actually arrives**, and each call
is authenticated with a secret token. It's the event-driven fit for an
event-driven platform.

**Trade-off:** the endpoint must be public and therefore carefully secret-verified,
and local testing needs a tunnel. Both are minor next to not running an idle loop.

## Why a pluggable LLM seam?

**Considered:** calling the Anthropic SDK directly from the parsing code versus
hiding it behind an interface.

**Chose the seam** (`LLM_PROVIDER` → Claude or Ollama behind one `complete()`
method). It lets me **develop fully offline on a local model** — no API cost, no
network — while production uses Claude for quality, with **no caller changes** to
switch. It also keeps the door open to a third provider.

**Trade-off:** a small amount of indirection and a lowest-common-denominator
interface. Worth it for the dev-loop speed and cost control. → [AI pipeline](04-ai-pipeline.md#the-provider-seam)

## Why keep business logic in `core/`?

Separating pure logic (`core/`) from transport (`backend/`, `api/`) means the same
validation, parsing, and settlement code serves **four ingestion channels** and is
**unit-testable without a server or database**. It's the decision that keeps
everything else small. → [repository structure](01-repository-structure.md#core--the-reason-the-rest-stays-simple)

---

## Quality & continuous integration

Correctness isn't left to hope. Three things enforce it automatically:

- **Tests** — `pytest` covers parsing, validation, settlement math, and every
  router; Vitest covers frontend logic (aggregation, claim math, error boundary).
  The pure `core/` layer is testable without a server, DB, or LLM tokens (parsing
  runs against a fake provider), which keeps the suite fast and deterministic.
- **CI pipeline** — a GitHub Actions workflow (`.github/workflows/ci.yml`) runs on
  every push to `master` and every pull request, in three jobs:
  a **backend** job (`ruff` lint + `ruff format --check` + `pytest`), a
  **frontend** job (`eslint` + `vitest` + `vite build` to catch build breaks), and
  a **secret-scan** job (`gitleaks` — cheap insurance for a public, clone-me repo).
- **Observability** — structured logging, fail-safe error handling, and health
  checks make failures diagnosable in production. → [observability](07-observability.md)

`ruff` was chosen deliberately: one fast tool replaces flake8 + black + isort.

---

## Accepted trade-offs

This is a learning project, and part of the learning was recognising what a
production lifecycle includes that this doesn't yet. These gaps are deliberate and
known, not oversights:

| Not done (yet) | Why it's acceptable for now | Planned direction |
|---|---|---|
| **Containerization** | Vercel's build handles the runtime; no orchestration need. | Dockerize the backend if it ever moves off serverless. |
| **External log aggregation** | Structured logs, request IDs, health checks, and opt-in error tracking already exist; logs stream to stdout. | Drain stdout to a log service on a server-hosted path. |
| **Local / SQLite storage** | Ships on Supabase; the DB seam (`core/db.py`) is isolated but not yet swappable. | A true local-first storage backend for full self-hosting. |
| **End-to-end (browser) tests** | Core logic and components are covered by pytest + Vitest; CI runs them on every push. | Add Playwright coverage for the critical user flows. |
| **Conversational AI agent** | Extraction + analysis shipped first; an agent is a larger surface. | A Claude tool-use agent answering "how am I doing this month?" |

Naming the gaps honestly — and knowing the next step for each — is itself part of
understanding what building software end-to-end actually looks like.
