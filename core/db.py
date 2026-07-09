import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

url: str = os.environ["SUPABASE_URL"]
key: str = os.environ["SUPABASE_KEY"]

supabase: Client = create_client(url, key)


def ping() -> bool:
    """Lightweight readiness check: can we reach Supabase?"""
    try:
        supabase.table("transactions").select("id").limit(1).execute()
        return True
    except Exception:
        return False
