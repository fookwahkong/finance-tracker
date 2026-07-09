# Run once locally to generate GMAIL_CREDENTIALS:
#   python scripts/gmail_auth.py
# Requires credentials.json in the project root (download from Google Cloud Console).
import json

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
creds = flow.run_local_server(port=0)

token_json = json.loads(creds.to_json())
print("\n--- GMAIL_CREDENTIALS value (paste into .env and Vercel dashboard) ---")
print(json.dumps(token_json))
