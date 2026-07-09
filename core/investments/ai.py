"""Claude-backed generation for the investment tab (spec §11).

Exactly two jobs — bull/bear cases and holdings-news summaries. Both are
cached in investment_cache and must always render behind a visible
"AI-generated, not financial advice" caveat in the UI.
"""

import json
import os

from core.investments import cache

MODEL = os.environ.get("INVEST_CLAUDE_MODEL", "claude-sonnet-5")
BULL_BEAR_TTL = 604800  # 7 days
NEWS_SUMMARY_TTL = 86400  # 24 hours

_BULL_BEAR_SYSTEM = (
    "You are an equity research assistant helping a calm, long-term investor. "
    "From the fundamentals and headlines provided, write a balanced bull case "
    "and bear case. Respond with JSON only, no prose around it: "
    '{"bull": ["point", "point", "point"], "bear": ["point", "point", "point"]}. '
    "Each point is one specific sentence grounded in the data. "
    "This is decision support, not financial advice."
)

_NEWS_SYSTEM = (
    "You summarise stock news for a calm, long-term investor. For each ticker, "
    "write 1-2 factual sentences covering only the most consequential items — "
    "no hype, no advice. Respond with JSON only: "
    '[{"ticker": "XYZ", "summary": "..."}] with one entry per ticker.'
)


def _extract_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)


class InvestAI:
    def __init__(self):
        import anthropic

        self._client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    def _complete(self, system: str, user: str) -> str:
        message = self._client.messages.create(
            model=MODEL,
            max_tokens=1000,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return message.content[0].text

    def bull_bear(self, symbol: str, profile: dict, ratios: list, news: list) -> dict:
        symbol = symbol.upper()

        def generate():
            payload = {
                "symbol": symbol,
                "profile": profile,
                "annual_ratios": ratios[:5],
                "headlines": [n.get("headline", "") for n in news[:10]],
            }
            return _extract_json(self._complete(_BULL_BEAR_SYSTEM, json.dumps(payload)))

        return cache.get_or_fetch(f"{symbol}:bullbear", generate, BULL_BEAR_TTL)

    def news_summary(self, news_by_ticker: dict) -> list:
        from datetime import date

        tickers = ",".join(sorted(news_by_ticker))

        def generate():
            trimmed = {
                t: [n.get("headline", "") for n in items[:6]] for t, items in news_by_ticker.items()
            }
            return _extract_json(self._complete(_NEWS_SYSTEM, json.dumps(trimmed)))

        return cache.get_or_fetch(
            f"news-summary:{date.today().isoformat()}:{tickers}",
            generate,
            NEWS_SUMMARY_TTL,
        )
