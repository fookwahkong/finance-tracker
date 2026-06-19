import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.routers import transactions, categories, reports
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


app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(categories.router, prefix="/categories", tags=["categories"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])


@app.get("/")
def root():
    return {"status": "ok"}
