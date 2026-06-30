import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routers import transactions, categories, reports, telegram, ingest, statements, budgets, subscriptions, networth, claims
from backend.routers.investments import (
    market as investments_market,
    financials as investments_financials,
    company as investments_company,
)
from core.validation import ValidationError

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app = FastAPI(title="Finance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValidationError)
async def _validation_error_handler(request: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


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


@app.get("/")
def root():
    return {"status": "ok"}
