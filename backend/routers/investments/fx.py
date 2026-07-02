from fastapi import APIRouter, HTTPException

from core.investments.providers.fx import FxClient

router = APIRouter()
client = FxClient()


@router.get("/usd-sgd")
def get_usd_sgd():
    try:
        return client.usd_sgd()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
