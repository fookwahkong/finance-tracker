import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("PERSONAL_USER_ID", "00000000-0000-0000-0000-000000000001")
os.environ.setdefault("DEMO_USER_ID", "00000000-0000-0000-0000-000000000002")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
os.environ.setdefault("LLM_PROVIDER", "claude")
os.environ.setdefault("CRON_SECRET", "test-cron-secret")
os.environ.setdefault("GMAIL_QUERY", "is:unread from:donotreply@dbs.com")
os.environ.setdefault(
    "GMAIL_CREDENTIALS",
    '{"token":"x","refresh_token":"y","client_id":"z","client_secret":"w","token_uri":"https://oauth2.googleapis.com/token","scopes":["https://www.googleapis.com/auth/gmail.modify"]}',
)
os.environ.setdefault("POLYGON_API_KEY", "test-polygon-key")
os.environ.setdefault("FMP_API_KEY", "test-fmp-key")
os.environ.setdefault("FINNHUB_API_KEY", "test-finnhub-key")
