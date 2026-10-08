import asyncio
import logging

from bson import ObjectId
from fastapi import APIRouter, HTTPException

import llm
from deps import db
from models import CheatsheetIn, CheatsheetRecord, CheatsheetRegen, CheatsheetUpdate, DocumentRecord, now_iso
from routes_documents import delete_doc_data, library_scope, oid, original_path, spawn_processing

logger = logging.getLogger("ori.cheats")
router = APIRouter()
_TASKS = set()

FORMATS = {
    "Resumen": "un resumen estructurado con títulos breves y viñetas",
    "Tabla": "una o varias tablas markdown claras, con columnas bien definidas (incluye una columna 'Fuente')",
    "Esquema": "un esquema jerárquico compacto que quepa en 1 página A4",
    "Preguntas-respuesta": "pares breves de pregunta y respuesta (**P:** / **R:**)",
    "Libre": "el formato que mejor encaje con las instrucciones",
}
CHEAT_SYSTEM = (
    "Eres Ori y creas CHULETAS (hojas de consulta rápida) en español para profesionales de la salud visual y auditiva. "
    "Usa ÚNICAMENTE el contenido de los DOCUMENTOS proporcionados; no añadas datos externos ni inventes valores. "
    "Cita la procedencia de cada dato o fila con [nombre_archivo, referencia], copiando literalmente archivo y referencia (p. ej. [guia.pdf, p. 3]). "
    "Si algo de lo pedido no aparece en los documentos, escribe 'No consta en los documentos'. "
    "Devuelve solo markdown limpio y conciso, apto para imprimir en A4, empezando por un título '# '."
)


def spawn(coro):
    t = asyncio.create_task(coro)
    _TASKS.add(t)
    t.add_done_callback(_TASKS.discard)


async def get_cheat(cid: str) -> CheatsheetRecord:
    c = await db.cheatsheets.find_one({"_id": oid(cid)})
    if not c:
        raise HTTPException(404, "Chuleta no encontrada")
    return CheatsheetRecord.from_mongo(c)


async def generate(cid: str):
    cs = await get_cheat(cid)
    try:
        chunks = await db.chunks.find({"doc_id": {"$in": cs.doc_ids}, "kind": "doc"}, {"embedding": 0}).to_list(20000)
        order = {d: i for i, d in enumerate(cs.doc_ids)}
        chunks.sort(key=lambda c: (order.get(c["doc_id"], 99), c["idx"]))
        ctx, total = [], 0
        for c in chunks:
            block = f"[{c['file_name']} | {c['ref']}]\n{c['text']}"
            if total + len(block) > 150000:
                break
            ctx.append(block)
            total += len(block)
        if not ctx:
            raise ValueError("Los documentos seleccionados no tienen texto procesado")
        prompt = ("DOCUMENTOS:\n\n" + "\n\n".join(ctx) + f"\n\nFORMATO DESEADO: {FORMATS[cs.format]}\n"
                  f"INSTRUCCIONES DEL USUARIO: {cs.instructions}")
        content = await llm.complete(CHEAT_SYSTEM, prompt, retries=3, base_delay=3)
        await db.cheatsheets.update_one({"_id": ObjectId(cid)}, {"$set": {
            "content": content.strip(), "status": "ready", "error": None, "updated_at": now_iso()}})
    except Exception as e:
        logger.exception("cheatsheet %s failed", cid)
        await db.cheatsheets.update_one({"_id": ObjectId(cid)}, {"$set": {
            "status": "error", "error": (getattr(e, "message", None) or str(e))[:400]}})


@router.get("/cheatsheets")
async def list_cheatsheets(library: str = "common", profile_id: str = None):
    items = await db.cheatsheets.find({"scope": library_scope(library, profile_id)}, {"content": 0}).sort("updated_at", -1).to_list(1000)
    return [CheatsheetRecord.from_mongo(c) for c in items]


@router.get("/cheatsheets/{cid}", response_model=CheatsheetRecord)
async def get_cheatsheet(cid: str):
    return await get_cheat(cid)


@router.post("/cheatsheets", response_model=CheatsheetRecord)
async def create_cheatsheet(body: CheatsheetIn):
    docs = await db.documents.find({"_id": {"$in": [oid(d) for d in body.doc_ids]}}).to_list(20)
    if len(docs) != len(set(body.doc_ids)):
        raise HTTPException(404, "Algún documento no existe")
    prof = await db.profiles.find_one({"_id": oid(body.profile_id)})
    if not prof:
        raise HTTPException(404, "Perfil no encontrado")
    names = {str(d["_id"]): d["file_name"] for d in docs}
    rec = CheatsheetRecord(
        title=(body.title or "").strip() or f"Chuleta: {body.instructions.strip()[:60]}",
        scope=library_scope(body.library, body.profile_id), doc_ids=body.doc_ids,
        sources=[names[d] for d in body.doc_ids], tags=body.tags, instructions=body.instructions.strip(),
        format=body.format, created_by=body.profile_id, created_by_name=prof["name"])
    rec.id = str((await db.cheatsheets.insert_one(rec.to_mongo())).inserted_id)
    spawn(generate(rec.id))
    return rec


@router.patch("/cheatsheets/{cid}", response_model=CheatsheetRecord)
async def update_cheatsheet(cid: str, body: CheatsheetUpdate):
    await get_cheat(cid)
    changes = body.model_dump(exclude_none=True)
    changes["updated_at"] = now_iso()
    await db.cheatsheets.update_one({"_id": ObjectId(cid)}, {"$set": changes})
    return await get_cheat(cid)


@router.post("/cheatsheets/{cid}/regenerate", response_model=CheatsheetRecord)
async def regenerate_cheatsheet(cid: str, body: CheatsheetRegen):
    await get_cheat(cid)
    await db.cheatsheets.update_one({"_id": ObjectId(cid)}, {"$set": {
        "instructions": body.instructions.strip(), "format": body.format, "status": "generating", "error": None}})
    spawn(generate(cid))
    return await get_cheat(cid)


@router.post("/cheatsheets/{cid}/save-to-library")
async def save_to_library(cid: str, profile_id: str):
    cs = await get_cheat(cid)
    if cs.status != "ready" or not cs.content.strip():
        raise HTTPException(400, "La chuleta aún no está lista")
    if cs.library_doc_id:
        await delete_doc_data(cs.library_doc_id)
    data = cs.content.encode("utf-8")
    rec = DocumentRecord(file_name=f"Chuleta - {cs.title[:80]}.md", file_type="md", scope=cs.scope,
                         profile_id=cs.scope.split(":", 1)[1] if cs.scope.startswith("profile:") else None,
                         uploaded_by=profile_id, tags=sorted(set(cs.tags + ["chuleta"])),
                         notes=f"Chuleta generada a partir de: {', '.join(cs.sources)}", size=len(data), has_original=True)
    rec.id = str((await db.documents.insert_one(rec.to_mongo())).inserted_id)
    original_path(rec).write_bytes(data)
    spawn_processing(rec.id)
    await db.cheatsheets.update_one({"_id": ObjectId(cid)}, {"$set": {"library_doc_id": rec.id}})
    return {"library_doc_id": rec.id}


@router.delete("/cheatsheets/{cid}")
async def delete_cheatsheet(cid: str):
    await get_cheat(cid)
    await db.cheatsheets.delete_one({"_id": ObjectId(cid)})
    return {"deleted": cid}
