from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from core.investments.providers.finnhub import FinnhubClient
from core.investments.providers.polygon import PolygonClient

router = APIRouter()
client = PolygonClient()
finnhub = FinnhubClient()


@router.get("/quote/{symbol}")
def get_quote(symbol: str):
    try:
        return finnhub.quote(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/news")
def get_market_news():
    try:
        return finnhub.market_news()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/earnings-calendar")
def get_earnings_calendar():
    from_ = date.today().isoformat()
    to = (date.today() + timedelta(days=14)).isoformat()
    try:
        return finnhub.earnings_calendar_range(from_, to)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/ticker/{symbol}")
def get_ticker(symbol: str):
    try:
        return client.ticker_details(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/aggregates/{symbol}")
def get_aggregates(
    symbol: str,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
):
    to = to or date.today().isoformat()
    from_ = from_ or (date.today() - timedelta(days=30)).isoformat()
    try:
        return client.aggregates(symbol, from_, to)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/dividends/{symbol}")
def get_dividends(symbol: str):
    try:
        return client.dividends(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/sma/{symbol}")
def get_sma(symbol: str):
    try:
        return client.sma(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
