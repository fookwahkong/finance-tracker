import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from backend.routers import transactions, categories, reports, telegram, ingest, statements, budgets, subscriptions, networth, claims
from backend.routers.investments import (
    market as investments_market,
    financials as investments_financials,
    company as investments_company,
    portfolio as investments_portfolio,
    fx as investments_fx,
    ai as investments_ai,
)
from core.db import ping as db_ping
from core.logging import configure_logging, get_logger
from core.validation import ValidationError

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

configure_logging()
logger = get_logger("app")

app = FastAPI(title="Finance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(ValidationError)
async def _validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    request_id = structlog.contextvars.get_contextvars().get("request_id", "")
    logger.error("unhandled_exception", exc_info=exc, path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal error", "request_id": request_id},
    )


app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(telegram.router, prefix="/api", tags=["telegram"])
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(statements.router, prefix="/api/statements", tags=["statements"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(networth.router, prefix="/api/networth", tags=["networth"])
app.include_router(claims.router, prefix="/api/claims", tags=["claims"])
app.include_router(investments_market.router, prefix="/api/investments/market", tags=["investments"])
app.include_router(investments_financials.router, prefix="/api/investments/financials", tags=["investments"])
app.include_router(investments_company.router, prefix="/api/investments/company", tags=["investments"])
app.include_router(investments_portfolio.router, prefix="/api/investments/portfolio", tags=["investments"])
app.include_router(investments_fx.router, prefix="/api/investments/fx", tags=["investments"])
app.include_router(investments_ai.router, prefix="/api/investments/ai", tags=["investments"])


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/ready")
def health_ready():
    if db_ping():
        return {"status": "ready"}
    return JSONResponse(status_code=503, content={"status": "unavailable"})
