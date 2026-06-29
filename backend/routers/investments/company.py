from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from core.investments.providers.finnhub import FinnhubClient

router = APIRouter()
client = FinnhubClient()


@router.get("/profile/{symbol}")
def get_profile(symbol: str):
    try:
        return client.company_profile(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/news/{symbol}")
def get_news(
    symbol: str,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
):
    to = to or date.today().isoformat()
    from_ = from_ or (date.today() - timedelta(days=7)).isoformat()
    try:
        return client.company_news(symbol, from_, to)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/earnings/{symbol}")
def get_earnings(symbol: str):
    try:
        return client.earnings_calendar(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
