from datetime import date as Date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    date: Date
    item: str
    category: Optional[str] = None
    amount: Optional[float] = None
    source: Optional[str] = None
    currency: str = "SGD"
    foreign_amount: Optional[float] = None


class TransactionUpdate(BaseModel):
    date: Optional[Date] = None
    item: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    source: Optional[str] = None
    currency: Optional[str] = None
    foreign_amount: Optional[float] = None


class Transaction(TransactionCreate):
    id: str


class ParsedRow(BaseModel):
    date: Date
    item: str
    amount: float
    source: Optional[str] = None
    category: Optional[str] = None


class ImportRequest(BaseModel):
    rows: list[ParsedRow]


class CategoryCreate(BaseModel):
    name: str


class Category(BaseModel):
    id: str
    name: str


class BudgetUpsert(BaseModel):
    category: str
    amount: float


class Budget(BaseModel):
    id: str
    category: str
    amount: float


class SubscriptionCreate(BaseModel):
    type: str
    item: str
    amount: float
    category: str
    source: str = "card"
    day_of_month: int


class Subscription(SubscriptionCreate):
    id: str


class NetWorthUpsert(BaseModel):
    month: str
    cash: float


class NetWorth(BaseModel):
    id: str
    month: str
    cash: float


class ClaimCreate(BaseModel):
    debit_tx_id: str
    my_share: Optional[float] = None
    counterparty: Optional[str] = None
    participant_names: list[str] = Field(default_factory=list)
    split_mode: Literal["equal", "custom"] = "equal"
    my_share_percent: Optional[float] = None


class ClaimCreditCreate(BaseModel):
    credit_tx_id: str
    allocated_amount: float


class InvestTransactionUpsert(BaseModel):
    ticker: str
    type: Literal["BUY", "SELL"]
    quantity: float
    price_per_share: float
    purchase_date: str


class WatchlistAdd(BaseModel):
    ticker: str


class TravelGroupCreate(BaseModel):
    name: str
    destination: Optional[str] = None
    start_date: Date
    end_date: Date


class TravelGroupUpdate(BaseModel):
    name: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[Date] = None
    end_date: Optional[Date] = None


class TravelOverrideUpsert(BaseModel):
    transaction_id: str
    mode: Literal["include", "exclude"]


class AgentChatRequest(BaseModel):
    message: str
    history: list[dict] = Field(default_factory=list)
