import asyncio
import json
import os
from datetime import date

import anthropic
import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import ApplicationBuilder, ContextTypes, MessageHandler, filters

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

_anthropic = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

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
    message = _anthropic.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    text = message.content[0].text.strip()
    return json.loads(text)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()

    try:
        with httpx.Client(base_url=BACKEND_URL, timeout=10) as client:
            cats_resp = client.get("/categories")
            cats_resp.raise_for_status()
            categories = [c["name"] for c in cats_resp.json()]

            parsed = parse_transaction(text, categories)

            tx_resp = client.post("/transactions", json=parsed)
            tx_resp.raise_for_status()
            tx = tx_resp.json()

        sign = "+" if tx["amount"] > 0 else ""
        reply = (
            f"Recorded: {tx['item']}\n"
            f"Amount: {sign}{tx['amount']}\n"
            f"Category: {tx.get('category') or 'Uncategorized'}\n"
            f"Date: {tx['date']}"
        )
        await update.message.reply_text(reply)

    except json.JSONDecodeError:
        await update.message.reply_text(
            "Could not parse that. Try: 'Coffee 4.50 Food' or 'Salary 3000 Income'"
        )
    except Exception as e:
        await update.message.reply_text(f"Error: {e}")


def main():
    asyncio.set_event_loop(asyncio.new_event_loop())
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print("Bot running...")
    app.run_polling()


if __name__ == "__main__":
    main()
