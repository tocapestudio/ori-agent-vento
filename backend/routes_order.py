import re
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from deps import db

router = APIRouter()
KEY = re.compile(r"^[\w:.\-]{1,200}$")


class OrderIn(BaseModel):
    ids: List[str] = Field(max_length=5000)


def check(key: str):
    if not KEY.match(key):
        raise HTTPException(400, "Clave de orden no válida")


@router.get("/orders/{key}")
async def get_order(key: str):
    check(key)
    d = await db.orders.find_one({"_id": key})
    return {"key": key, "ids": d["ids"] if d else []}


@router.put("/orders/{key}")
async def put_order(key: str, body: OrderIn):
    check(key)
    await db.orders.update_one({"_id": key}, {"$set": {"ids": body.ids}}, upsert=True)
    return {"key": key, "ids": body.ids}
