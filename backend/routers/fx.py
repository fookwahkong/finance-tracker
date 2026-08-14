from fastapi import APIRouter, HTTPException

from core.fx import FxClient

router = APIRouter()
client = FxClient()


@router.get("/rate")
def get_rate(base: str, quote: str):
    try:
        return client.rate(base, quote)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
