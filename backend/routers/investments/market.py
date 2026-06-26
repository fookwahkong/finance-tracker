from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from core.investments.providers.polygon import PolygonClient

router = APIRouter()
client = PolygonClient()


@router.get("/ticker/{symbol}")
def get_ticker(symbol: str):
    try:
        return client.ticker_details(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/prev-close/{symbol}")
def get_prev_close(symbol: str):
    try:
        return client.previous_close(symbol)
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
