from fastapi import APIRouter, Depends, HTTPException, Request

import llm
from auth import (check_lock, get_auth_doc, hash_code, make_token, register_fail, require_team,
                  verify_code)
from deps import db
from models import AccessCodeChange, AccessIn, LLMSettingsIn, ProfileIn, ProfileRecord
from routes_documents import delete_doc_data, oid
from settings_store import get_llm_settings, public_settings, save_llm_settings

public = APIRouter()
router = APIRouter()


@public.get("/")
async def root():
    return {"message": "Ori API", "status": "ok"}


@public.post("/auth/access")
async def access(body: AccessIn, request: Request):
    ip = request.headers.get("x-forwarded-for", request.client.host).split(",")[0].strip()
    await check_lock(ip)
    auth = await get_auth_doc()
    if not verify_code(body.code, auth["code_hash"]):
        await register_fail(ip)
        raise HTTPException(401, "Código de acceso incorrecto")
    await db.login_attempts.delete_one({"_id": ip})
    return {"token": make_token(auth["version"])}


@public.get("/auth/check", dependencies=[Depends(require_team)])
async def check():
    return {"ok": True}


@router.get("/profiles")
async def list_profiles():
    return [ProfileRecord.from_mongo(p) for p in await db.profiles.find().sort("created_at", 1).to_list(200)]


@router.post("/profiles", response_model=ProfileRecord)
async def create_profile(body: ProfileIn):
    rec = ProfileRecord(name=body.name.strip(), color=body.color)
    rec.id = str((await db.profiles.insert_one(rec.to_mongo())).inserted_id)
    return rec


@router.patch("/profiles/{pid}", response_model=ProfileRecord)
async def update_profile(pid: str, body: ProfileIn):
    p = await db.profiles.find_one_and_update({"_id": oid(pid)}, {"$set": {"name": body.name.strip(), "color": body.color}},
                                              return_document=True)
    if not p:
        raise HTTPException(404, "Perfil no encontrado")
    return ProfileRecord.from_mongo(p)


@router.delete("/profiles/{pid}")
async def delete_profile(pid: str):
    if not (await db.profiles.delete_one({"_id": oid(pid)})).deleted_count:
        raise HTTPException(404, "Perfil no encontrado")
    for d in await db.documents.find({"scope": f"profile:{pid}"}, {"_id": 1}).to_list(5000):
        await delete_doc_data(str(d["_id"]))
    conv_ids = [str(c["_id"]) for c in await db.conversations.find({"profile_id": pid}, {"_id": 1}).to_list(5000)]
    await db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
    await db.conversations.delete_many({"profile_id": pid})
    await db.folders.delete_many({"scope": f"profile:{pid}"})
    await db.templates.delete_many({"scope": f"profile:{pid}"})
    await db.cheatsheets.delete_many({"scope": f"profile:{pid}"})
    await db.favorites.delete_many({"$or": [{"saved_by": pid}, {"conversation_id": {"$in": conv_ids}}]})
    return {"deleted": pid}


@router.get("/settings")
async def get_settings():
    return public_settings(await get_llm_settings())


@router.put("/settings")
async def put_settings(body: LLMSettingsIn):
    await save_llm_settings({k: v.strip() for k, v in body.model_dump(exclude_none=True).items() if v.strip()})
    return public_settings(await get_llm_settings())


@router.post("/settings/test-llm")
async def test_llm():
    s = await get_llm_settings()
    try:
        out = await llm.complete("Responde en español en una sola frase.", "Di 'Hola, soy Ori' y nada más.")
    except llm.LLMError as e:
        return {"ok": False, "backend": s["llm_backend"], "message": e.message}
    return {"ok": True, "backend": s["llm_backend"], "message": out.strip()[:200]}


@router.post("/settings/access-code")
async def change_access_code(body: AccessCodeChange):
    auth = await get_auth_doc()
    if not verify_code(body.current_code, auth["code_hash"]):
        raise HTTPException(400, "El código actual no es correcto")
    version = auth["version"] + 1
    await db.settings.update_one({"_id": "auth"}, {"$set": {"code_hash": hash_code(body.new_code), "version": version}})
    return {"token": make_token(version)}
