import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

url: str = os.environ["SUPABASE_URL"]
_service_key: str = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ["SUPABASE_KEY"]

# Service-role client: bypasses RLS. Used only by trusted server jobs
# (email cron, Telegram, iOS shortcut, demo reset) and readiness checks.
service_client: Client = create_client(url, _service_key)

# Backwards-compatible alias so trusted routers can keep `from core.db import supabase`.
supabase: Client = service_client


def user_client(jwt: str) -> Client:
    """A request-scoped client that acts as the caller. RLS is enforced."""
    anon_key = os.environ["SUPABASE_ANON_KEY"]
    client = create_client(url, anon_key)
    client.postgrest.auth(jwt)
    return client


def ping() -> bool:
    """Lightweight readiness check: can we reach Supabase?"""
    try:
        service_client.table("transactions").select("id").limit(1).execute()
        return True
    except Exception:
        return False
