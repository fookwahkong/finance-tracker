from datetime import date as Date
from typing import Optional
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    date: Date
    item: str
    category: Optional[str] = None
    amount: float
    source: Optional[str] = None


class TransactionUpdate(BaseModel):
    date: Optional[Date] = None
    item: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    source: Optional[str] = None


class Transaction(TransactionCreate):
    id: str


class CategoryCreate(BaseModel):
    name: str


class Category(BaseModel):
    id: str
    name: str

