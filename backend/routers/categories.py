from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from backend.deps import get_db
from core.models import CategoryCreate

router = APIRouter()


@router.get("")
def list_categories(db: Client = Depends(get_db)):
    result = db.table("categories").select("*").order("name").execute()
    return result.data


@router.post("", status_code=201)
def create_category(cat: CategoryCreate, db: Client = Depends(get_db)):
    result = db.table("categories").insert({"name": cat.name}).execute()
    return result.data[0]


@router.delete("/{cat_id}", status_code=204)
def delete_category(cat_id: str, db: Client = Depends(get_db)):
    result = db.table("categories").delete().eq("id", cat_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Category not found")
