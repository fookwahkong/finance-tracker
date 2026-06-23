from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    date: date
    time: Optional[str] = None
    item: str
    category: Optional[str] = None
    amount: float
    source: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    time: Optional[str] = None
    item: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    source: Optional[str] = None


class Transaction(TransactionCreate):
    id: str
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str


class Category(BaseModel):
    id: str
    name: str
    created_at: datetime
