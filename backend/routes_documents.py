import asyncio
import logging
import mimetypes
import os
import time
from pathlib import Path
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

import llm
from deps import db
from ingest import SUPPORTED, chunk_text, extract_units
from models import ChunkRecord, DocumentRecord, DocumentUpdate, SearchRequest
from retrieval import embed, hybrid_search, index_chunks, unindex

logger = logging.getLogger("ori.docs")
router = APIRouter()
STORAGE = Path(os.environ["STORAGE_DIR"])
STORAGE.mkdir(parents=True, exist_ok=True)


def oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(404, "No encontrado")
    return ObjectId(value)


def library_scope(library: str, profile_id: Optional[str]) -> str:
    if library == "common":
        return "common"
    if library == "mine" and profile_id:
        return f"profile:{profile_id}"
    raise HTTPException(400, "library debe ser 'common' o 'mine' (con profile_id)")


def scopes_for(scope: str, profile_id: Optional[str]) -> list:
    mine = f"profile:{profile_id}" if profile_id else None
    if scope == "mine":
        if not mine:
            raise HTTPException(400, "profile_id es obligatorio para 'mine'")
        return [mine]
    if scope == "common" or not mine:
        return ["common"]
    return ["common", mine]


def original_path(doc: DocumentRecord) -> Path:
    return STORAGE / f"{doc.id}.{doc.file_type}"


async def store_chunks(doc: DocumentRecord, items: List[tuple], kind: str) -> int:
    if not items:
        return 0
    vectors = await asyncio.to_thread(embed, [t for _, t in items])
    records = [ChunkRecord(doc_id=doc.id, scope=doc.scope, file_name=doc.file_name, ref=ref, kind=kind,
                           idx=i, text=text, embedding=vec).to_mongo()
               for i, ((ref, text), vec) in enumerate(zip(items, vectors))]
    res = await db.chunks.insert_many(records)
    await index_chunks(res.inserted_ids, records, vectors)
    return len(records)


async def sync_note_chunk(doc: DocumentRecord):
    old = await db.chunks.find({"doc_id": doc.id, "kind": "note"}, {"_id": 1}).to_list(100)
    if old:
        await db.chunks.delete_many({"_id": {"$in": [o["_id"] for o in old]}})
        await unindex(chunk_ids=[o["_id"] for o in old])
    if not (doc.notes.strip() or doc.tags):
        return
    text = f"Notas del profesional sobre {doc.file_name}"
    if doc.tags:
        text += f" (etiquetas: {', '.join(doc.tags)})"
    await store_chunks(doc, [("notas", f"{text}: {doc.notes.strip()}")], "note")


async def delete_doc_data(doc_id: str):
    d = await db.documents.find_one_and_delete({"_id": ObjectId(doc_id)})
    await db.chunks.delete_many({"doc_id": doc_id})
    await unindex(doc_id=doc_id)
    if d:
        original_path(DocumentRecord.from_mongo(d)).unlink(missing_ok=True)
    return d


DOC_TIMEOUT = 1800
MAX_ATTEMPTS = 2
STALE_SECONDS = 600


def _error_text(e: BaseException) -> str:
    if isinstance(e, asyncio.TimeoutError):
        return "El procesamiento tardó demasiado y se ha detenido. Pulsa «Reprocesar» para intentarlo de nuevo."
    if type(e).__name__ in ("FileDataError", "EmptyFileError", "PackageNotFoundError", "BadZipFile", "InvalidFileException"):
        return "El archivo está dañado o no se puede abrir. Prueba a exportarlo de nuevo y vuelve a subirlo."
    msg = getattr(e, "message", None) or str(e) or type(e).__name__
    return msg if isinstance(e, (ValueError, llm.LLMError)) else f"Error al procesar el documento ({type(e).__name__}): {msg}"


async def _process(doc_id: str):
    doc = DocumentRecord.from_mongo(await db.documents.find_one({"_id": ObjectId(doc_id)}))
    path = original_path(doc)
    if not path.exists():
        raise ValueError("No se encuentra el archivo original en el equipo")
    await db.chunks.delete_many({"doc_id": doc_id})
    await unindex(doc_id=doc_id)
    logger.info("Procesando %s (%s): extrayendo texto", doc_id, doc.file_type)
    units, ocr_used = await extract_units(str(path), doc.file_type)
    items = [(ref, c) for ref, text in units for c in chunk_text(text or "")]
    if not items:
        raise ValueError("No se pudo extraer texto del archivo")
    logger.info("Procesando %s: %d fragmentos, calculando embeddings", doc_id, len(items))
    n = await store_chunks(doc, items, "doc")
    await sync_note_chunk(doc)
    res = await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {
        "status": "ready", "chunk_count": n, "units": len(units), "ocr_used": ocr_used,
        "text_chars": sum(len(t or "") for _, t in units), "error": None}})
    if res.matched_count == 0:
        await db.chunks.delete_many({"doc_id": doc_id})
        await unindex(doc_id=doc_id)
    logger.info("Documento %s listo: %d fragmentos", doc_id, n)


async def process_document(doc_id: str):
    await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"processing_started_at": time.time()},
                                                              "$inc": {"attempts": 1}})
    try:
        await asyncio.wait_for(_process(doc_id), DOC_TIMEOUT)
    except asyncio.CancelledError:
        raise
    except BaseException as e:  # noqa: BLE001 - any failure must surface as status "error"
        logger.exception("Processing failed for %s", doc_id)
        await db.chunks.delete_many({"doc_id": doc_id})
        await unindex(doc_id=doc_id)
        await db.documents.update_one({"_id": ObjectId(doc_id)}, {"$set": {"status": "error", "error": _error_text(e)[:500]}})


_TASKS = set()
_ACTIVE = set()
_SEM = None


async def _queued(doc_id: str):
    global _SEM
    _SEM = _SEM or asyncio.Semaphore(3)
    try:
        async with _SEM:
            await process_document(doc_id)
    finally:
        _ACTIVE.discard(doc_id)


def spawn_processing(doc_id: str):
    if doc_id in _ACTIVE:
        return
    _ACTIVE.add(doc_id)
    task = asyncio.create_task(_queued(doc_id))
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)


async def requeue_orphans(min_age: float = 0, reset: bool = False) -> int:
    """Docs left in 'processing' with no live task: re-queue once, then mark as error."""
    n = 0
    async for d in db.documents.find({"status": "processing"}, {"_id": 1, "attempts": 1, "processing_started_at": 1, "has_original": 1}):
        doc_id = str(d["_id"])
        if doc_id in _ACTIVE or time.time() - (d.get("processing_started_at") or 0) < min_age:
            continue
        if reset:
            await db.documents.update_one({"_id": d["_id"]}, {"$set": {"attempts": 0}})
        elif not d.get("has_original") or (d.get("attempts") or 0) >= MAX_ATTEMPTS:
            logger.warning("Documento %s atascado en 'procesando': marcado como error", doc_id)
            await db.documents.update_one({"_id": d["_id"]}, {"$set": {"status": "error", "error":
                "El procesamiento se interrumpió varias veces. Pulsa «Reprocesar» o revisa el registro (Diagnóstico)."}})
            continue
        logger.info("Reencolando documento atascado %s", doc_id)
        spawn_processing(doc_id)
        n += 1
    return n


async def watchdog():
    while True:
        await asyncio.sleep(300)
        try:
            await requeue_orphans(STALE_SECONDS)
        except Exception:  # noqa: BLE001 - keep the watchdog alive
            logger.exception("watchdog failed")


@router.post("/documents/upload", response_model=List[DocumentRecord])
async def upload_documents(
    files: List[UploadFile] = File(...),
    library: str = Form("common"),
    profile_id: Optional[str] = Form(None),
    tags: str = Form(""),
    notes: str = Form(""),
    folder_id: Optional[str] = Form(None),
):
    scope = library_scope(library, profile_id)
    folder_id = folder_id or None
    if folder_id:
        f = await db.folders.find_one({"_id": oid(folder_id)})
        if not f or f["scope"] != scope:
            raise HTTPException(400, "La carpeta no pertenece a esta biblioteca")
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    created = []
    for f in files:
        ext = (f.filename or "").rsplit(".", 1)[-1].lower()
        if ext not in SUPPORTED:
            raise HTTPException(400, f"Tipo de archivo no soportado: {f.filename}")
        data = await f.read()
        rec = DocumentRecord(file_name=f.filename, file_type="jpg" if ext == "jpeg" else ext, scope=scope,
                             profile_id=profile_id if library == "mine" else None, uploaded_by=profile_id,
                             tags=tag_list, notes=notes, size=len(data), has_original=True, folder_id=folder_id)
        rec.id = str((await db.documents.insert_one(rec.to_mongo())).inserted_id)
        original_path(rec).write_bytes(data)
        spawn_processing(rec.id)
        created.append(rec)
    return created


@router.get("/documents", response_model=List[DocumentRecord])
async def list_documents(library: str = "common", profile_id: Optional[str] = None,
                         q: Optional[str] = None, tag: Optional[str] = None):
    query = {"scope": library_scope(library, profile_id)}
    if q:
        query["$or"] = [{"file_name": {"$regex": q, "$options": "i"}}, {"tags": {"$regex": q, "$options": "i"}}]
    if tag:
        query["tags"] = tag
    docs = await db.documents.find(query).sort("created_at", -1).to_list(1000)
    return [DocumentRecord.from_mongo(d) for d in docs]


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    d = await db.documents.find_one({"_id": oid(doc_id)})
    if not d:
        raise HTTPException(404, "Documento no encontrado")
    chunks = await db.chunks.find({"doc_id": doc_id, "kind": "doc"}, {"embedding": 0}).sort("idx", 1).to_list(5000)
    preview, seen = [], {}
    for c in chunks:
        if c["ref"] not in seen:
            seen[c["ref"]] = len(preview)
            preview.append({"ref": c["ref"], "text": c["text"]})
        else:
            preview[seen[c["ref"]]]["text"] += "\n" + c["text"]
    return {"document": DocumentRecord.from_mongo(d).model_dump(), "preview": preview}


@router.get("/documents/{doc_id}/file")
async def get_document_file(doc_id: str, download: bool = False):
    d = await db.documents.find_one({"_id": oid(doc_id)})
    if not d:
        raise HTTPException(404, "Documento no encontrado")
    doc = DocumentRecord.from_mongo(d)
    path = original_path(doc)
    if not path.exists():
        raise HTTPException(404, "El archivo original no está disponible")
    media = mimetypes.guess_type(doc.file_name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=media, filename=doc.file_name,
                        content_disposition_type="attachment" if download else "inline")


@router.patch("/documents/{doc_id}", response_model=DocumentRecord)
async def update_document(doc_id: str, body: DocumentUpdate):
    changes = body.model_dump(exclude_none=True)
    if changes:
        await db.documents.update_one({"_id": oid(doc_id)}, {"$set": changes})
        if "file_name" in changes:
            await db.chunks.update_many({"doc_id": doc_id}, {"$set": {"file_name": changes["file_name"]}})
    d = await db.documents.find_one({"_id": oid(doc_id)})
    if not d:
        raise HTTPException(404, "Documento no encontrado")
    doc = DocumentRecord.from_mongo(d)
    if doc.status == "ready" and ({"notes", "tags", "file_name"} & changes.keys()):
        await sync_note_chunk(doc)
    return doc


@router.post("/documents/{doc_id}/reprocess", response_model=DocumentRecord)
async def reprocess_document(doc_id: str):
    d = await db.documents.find_one_and_update({"_id": oid(doc_id), "has_original": True},
                                               {"$set": {"status": "processing", "error": None, "attempts": 0}}, return_document=True)
    if not d:
        raise HTTPException(404, "Documento sin original disponible")
    spawn_processing(doc_id)
    return DocumentRecord.from_mongo(d)


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    if not await delete_doc_data(str(oid(doc_id))):
        raise HTTPException(404, "Documento no encontrado")
    return {"deleted": doc_id}


@router.post("/search")
async def search(req: SearchRequest):
    return {"results": await hybrid_search(req.query, scopes_for(req.scope, req.profile_id), req.k)}
