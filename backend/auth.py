import os
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, Request

from deps import db

ALG = "HS256"
MAX_FAILS, LOCK_SECONDS = 5, 15 * 60


def hash_code(code: str) -> str:
    return bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()


def verify_code(code: str, hashed: str) -> bool:
    return bcrypt.checkpw(code.encode(), hashed.encode())


async def get_auth_doc() -> dict:
    return await db.settings.find_one({"_id": "auth"})


async def seed_access_code():
    if not await get_auth_doc():
        await db.settings.insert_one({"_id": "auth", "code_hash": hash_code(os.environ["TEAM_ACCESS_CODE"]), "version": 1})


def make_token(version: int) -> str:
    payload = {"type": "team", "ver": version, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=ALG)


async def check_lock(ip: str):
    att = await db.login_attempts.find_one({"_id": ip})
    if att and att.get("locked_until", 0) > time.time():
        mins = int((att["locked_until"] - time.time()) // 60) + 1
        raise HTTPException(429, f"Demasiados intentos. Inténtalo de nuevo en {mins} min.")


async def register_fail(ip: str):
    att = await db.login_attempts.find_one_and_update(
        {"_id": ip}, {"$inc": {"count": 1}}, upsert=True, return_document=True)
    if att["count"] >= MAX_FAILS:
        await db.login_attempts.update_one({"_id": ip}, {"$set": {"locked_until": time.time() + LOCK_SECONDS, "count": 0}})


async def require_team(request: Request):
    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else request.query_params.get("token")
    if not token:
        raise HTTPException(401, "Código de acceso requerido")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Sesión no válida o caducada")
    auth = await get_auth_doc()
    if payload.get("type") != "team" or payload.get("ver") != auth["version"]:
        raise HTTPException(401, "El código de acceso ha cambiado. Vuelve a introducirlo.")
    return True
