import json
import os
from datetime import date

import anthropic
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

SYSTEM_PROMPT = """You are a personal finance transaction parser.
Given a natural-language description of a transaction, extract the details and return ONLY a valid JSON object with these fields:
- date (string, YYYY-MM-DD — use today's date if not mentioned)
- item (string, short description of what was bought/received)
- category (string, pick the best match from the provided list, or null if none fit)
- amount (number, negative for expenses, positive for income)
- source (string, payment method if mentioned, otherwise null)
- remarks (string, any extra notes, otherwise null)

Return ONLY the raw JSON object. No markdown, no explanation."""


def parse_transaction(raw_text: str, categories: list[str]) -> dict:
    today = date.today().isoformat()
    user_message = (
        f"Today's date: {today}\n"
        f"Available categories: {', '.join(categories)}\n\n"
        f"Transaction: {raw_text}"
    )

    message = _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = message.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise ValueError(f"Claude returned non-JSON: {text}")
