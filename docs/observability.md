# Observability

This app is local-first: it sends nothing to third parties unless you opt in.

## Logging
Structured JSON logs are written to **stdout**. In development (`APP_ENV=dev`)
they render as pretty console output. Redirect stdout wherever you like —
a file, Docker logs, journald. Every log line within a request carries a
`request_id`, also returned in the `X-Request-ID` response header.

## Health checks
- `GET /health` — liveness, always 200.
- `GET /health/ready` — readiness; 200 when the database is reachable, 503 otherwise.

Point an uptime monitor (e.g. UptimeRobot, Better Stack) at `/health`.

## Error tracking (optional, off by default)
Set `SENTRY_DSN` (backend) and/or `VITE_SENTRY_DSN` (frontend) to a
[GlitchTip](https://glitchtip.com/) DSN to receive error reports. GlitchTip is
self-hostable and Sentry-SDK-compatible, so you can keep error data on your own
infrastructure. Leave these unset to send nothing.
