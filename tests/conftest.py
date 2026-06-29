import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("LLM_PROVIDER", "claude")
os.environ.setdefault("SHORTCUT_API_KEY", "test-shortcut-key")
os.environ.setdefault("CRON_SECRET", "test-cron-secret")
os.environ.setdefault("GMAIL_QUERY", "is:unread from:donotreply@dbs.com")
os.environ.setdefault(
    "GMAIL_CREDENTIALS",
    '{"token":"x","refresh_token":"y","client_id":"z","client_secret":"w","token_uri":"https://oauth2.googleapis.com/token","scopes":["https://www.googleapis.com/auth/gmail.modify"]}',
)
os.environ.setdefault("POLYGON_API_KEY", "test-polygon-key")
os.environ.setdefault("FMP_API_KEY", "test-fmp-key")
