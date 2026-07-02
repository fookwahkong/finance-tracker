from fastapi import APIRouter, HTTPException

from core.investments.providers.fmp import FMPClient

router = APIRouter()
client = FMPClient()


@router.get("/income/{symbol}")
def get_income(symbol: str):
    try:
        return client.income_statement(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/balance/{symbol}")
def get_balance(symbol: str):
    try:
        return client.balance_sheet(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/cashflow/{symbol}")
def get_cashflow(symbol: str):
    try:
        return client.cash_flow(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/ratios/{symbol}")
def get_ratios(symbol: str):
    try:
        return client.ratios(symbol)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
