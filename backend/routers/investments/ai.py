from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from core.investments import cache
from core.investments.ai import InvestAI, BULL_BEAR_TTL
from core.investments.providers.finnhub import FinnhubClient
from core.investments.providers.fmp import FMPClient

router = APIRouter()
ai = InvestAI()
finnhub = FinnhubClient()
fmp = FMPClient()


def _recent_news(symbol: str) -> list:
    to = date.today().isoformat()
    from_ = (date.today() - timedelta(days=7)).isoformat()
    return finnhub.company_news(symbol, from_, to)


@router.post("/bull-bear/{symbol}")
def generate_bull_bear(symbol: str):
    symbol = symbol.upper()
    try:
        profile = finnhub.company_profile(symbol)
        ratios = fmp.ratios(symbol)
        news = _recent_news(symbol)
        return ai.bull_bear(symbol, profile, ratios, news)
    except (RuntimeError, ValueError) as exc:
        # json.JSONDecodeError subclasses ValueError, so malformed AI output lands here too
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/bull-bear/{symbol}")
def peek_bull_bear(symbol: str):
    data = cache.peek(f"{symbol.upper()}:bullbear", BULL_BEAR_TTL)
    return {"cached": data is not None, "data": data}


@router.get("/news-summary")
def news_summary(tickers: str):
    symbols = sorted({t.strip().upper() for t in tickers.split(",") if t.strip()})
    if not symbols:
        raise HTTPException(status_code=422, detail="tickers query param is required")
    try:
        news_by_ticker = {s: _recent_news(s) for s in symbols}
        return ai.news_summary(news_by_ticker)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc))
