import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from deps import db
from models import FavoriteIn, FavoriteRecord, TemplateIn, TemplateRecord, TemplateUpdate, now_iso
from routes_documents import oid

router = APIRouter()

SEED_TEMPLATES = [
    ("Informe optométrico estándar", "Informe", """# Informe optométrico
**Paciente:** {{codigo_paciente}} · **Edad:** {{edad}} · **Fecha:** {{fecha}}

## Motivo de consulta
{{motivo_consulta}}

## Agudeza visual y refracción
- AV sin corrección: {{av_sc}}
- Refracción final: {{refraccion}}

## Visión binocular y acomodación
- Foria lejos / cerca: {{forias}}
- PPC: {{ppc}}
- Amplitud y flexibilidad acomodativa: {{acomodacion}}

## Valoración
{{valoracion}}

## Recomendaciones
{{recomendaciones}}
"""),
    ("Protocolo TV insuficiencia de convergencia", "Protocolo terapia visual", """# Protocolo de terapia visual
**Diagnóstico:** {{diagnostico}} · **Duración prevista:** {{duracion}}

## Objetivos
{{objetivos}}

## Fase 1 (semanas 1-4)
{{fase_1}}

## Fase 2 (semanas 5-8)
{{fase_2}}

## Ejercicios en casa
{{ejercicios_casa}}

## Criterios de alta
{{criterios_alta}}
"""),
]


def visible_scopes(profile_id: str) -> list:
    return ["common", f"profile:{profile_id}"]


async def seed_templates():
    if await db.settings.find_one({"_id": "templates_seeded"}):
        return
    for name, cat, body in SEED_TEMPLATES:
        await db.templates.insert_one(TemplateRecord(name=name, category=cat, body=body, scope="common").to_mongo())
    await db.settings.insert_one({"_id": "templates_seeded"})


async def get_visible_template(tid: str, profile_id: str) -> TemplateRecord:
    t = await db.templates.find_one({"_id": oid(tid), "scope": {"$in": visible_scopes(profile_id)}})
    if not t:
        raise HTTPException(404, "Plantilla no encontrada")
    return TemplateRecord.from_mongo(t)


@router.get("/templates")
async def list_templates(profile_id: str):
    items = await db.templates.find({"scope": {"$in": visible_scopes(profile_id)}}).sort("name", 1).to_list(1000)
    return [TemplateRecord.from_mongo(t) for t in items]


@router.post("/templates", response_model=TemplateRecord)
async def create_template(body: TemplateIn):
    scope = "common" if body.visibility == "common" else f"profile:{body.profile_id}"
    rec = TemplateRecord(name=body.name.strip(), category=body.category, body=body.body, scope=scope, created_by=body.profile_id)
    rec.id = str((await db.templates.insert_one(rec.to_mongo())).inserted_id)
    return rec


@router.patch("/templates/{tid}", response_model=TemplateRecord)
async def update_template(tid: str, body: TemplateUpdate):
    await get_visible_template(tid, body.profile_id)
    changes = body.model_dump(exclude_none=True, exclude={"profile_id", "visibility"})
    if body.visibility:
        changes["scope"] = "common" if body.visibility == "common" else f"profile:{body.profile_id}"
    changes["updated_at"] = now_iso()
    await db.templates.update_one({"_id": ObjectId(tid)}, {"$set": changes})
    return await get_visible_template(tid, body.profile_id)


@router.delete("/templates/{tid}")
async def delete_template(tid: str, profile_id: str):
    await get_visible_template(tid, profile_id)
    await db.templates.delete_one({"_id": ObjectId(tid)})
    return {"deleted": tid}


def _plain(text: str, n: int = 220) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[#*_`>\[\]]", "", text)).strip()[:n]


@router.get("/favorites")
async def list_favorites(q: Optional[str] = None, conversation_id: Optional[str] = None):
    query = {}
    if conversation_id:
        query["conversation_id"] = conversation_id
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"title": rx}, {"snippet": rx}, {"saved_by_name": rx}]
    items = await db.favorites.find(query).sort("created_at", -1).to_list(1000)
    return [FavoriteRecord.from_mongo(f) for f in items]


@router.post("/favorites", response_model=FavoriteRecord)
async def add_favorite(body: FavoriteIn):
    conv = await db.conversations.find_one({"_id": oid(body.conversation_id)})
    prof = await db.profiles.find_one({"_id": oid(body.profile_id)})
    if not conv or not prof:
        raise HTTPException(404, "Conversación o perfil no encontrado")
    snippet = ""
    if body.message_id:
        msg = await db.messages.find_one({"_id": oid(body.message_id), "conversation_id": body.conversation_id})
        if not msg:
            raise HTTPException(404, "Respuesta no encontrada")
        snippet = _plain(msg["content"])
    existing = await db.favorites.find_one({"conversation_id": body.conversation_id, "message_id": body.message_id,
                                            "saved_by": body.profile_id})
    if existing:
        return FavoriteRecord.from_mongo(existing)
    rec = FavoriteRecord(kind="message" if body.message_id else "conversation", conversation_id=body.conversation_id,
                         message_id=body.message_id, title=conv["title"], snippet=snippet,
                         owner_profile_id=conv["profile_id"], saved_by=body.profile_id, saved_by_name=prof["name"],
                         saved_by_color=prof.get("color", "#1B2A3A"))
    rec.id = str((await db.favorites.insert_one(rec.to_mongo())).inserted_id)
    return rec


@router.delete("/favorites/{fid}")
async def remove_favorite(fid: str, profile_id: str):
    fav = await db.favorites.find_one({"_id": oid(fid)})
    if not fav:
        raise HTTPException(404, "Favorito no encontrado")
    if fav["saved_by"] != profile_id:
        raise HTTPException(403, "Solo quien lo guardó puede quitarlo de favoritos")
    await db.favorites.delete_one({"_id": fav["_id"]})
    return {"deleted": fid}
