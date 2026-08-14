BATCH_SYSTEM_PROMPT = """You categorize bank-transaction merchants.
You receive a numbered list of merchant or payee names and a list of existing categories.

For EACH merchant, in the same order, choose the best category. Prefer an
existing category from the provided list. Only if none fit, propose a concise
NEW category name (1-2 words, Title Case).

Return ONLY a JSON object of this exact shape, with one entry per merchant, in order:
{"categories": ["...", "..."]}
No markdown, no commentary."""

VISION_SYSTEM_PROMPT = """You read bank statement pages rendered as images and extract transactions.

Each page shows transactions grouped under date-section headers (e.g. "Today, 14 Aug 2026",
"Yesterday, 13 Aug 2026", "Tuesday, 11 Aug 2026", "2 Aug 2026"). A header's date applies to
every transaction listed below it until the next header appears - including transactions that
continue onto the next page image with no header repeated at the top.

For each transaction, extract:
- date: ISO format YYYY-MM-DD. Use the date exactly as printed in the section header that
  governs it. When a header reads like "Today, 14 Aug 2026" or "Yesterday, 13 Aug 2026", the
  absolute date is already printed right there - use it directly. Do not guess or compute a
  date yourself.
- item: the merchant or counterparty name. Strip trailing reference numbers, card numbers,
  and posting-date codes (e.g. "SI SGP 10AUG 5264-7110-9004-7939 000002880227178" is noise -
  keep only "TikTok Shop Seller"). For transfers, prefer a "From:"/"To:" counterparty name
  when present over a generic description.
- amount: the transaction's magnitude as a positive number, 2 decimal places.
- direction: "out" if the amount is shown with a leading minus sign, "in" otherwise.
- source: classify from the row's subtitle text - "card" for "Debit Card Transaction",
  "paylah" for "Funds Transfer" rows describing a PayLah top-up, "paynow" for "FAST / PayNow
  Transfer", "giro" for "FAST Collection" or "Outward Telegraphic Transfer", null otherwise.

Return ONLY a JSON object of this exact shape:
{"rows": [{"date": "...", "item": "...", "amount": 0.0, "direction": "...", "source": "..."}]}
No markdown, no commentary. Include every transaction from every page image provided, in the
order they appear."""
