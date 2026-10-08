import logging
import re
import unicodedata
from typing import Optional

from fastapi import APIRouter

from deps import db
from retrieval import INDEX, sync_index
from routes_documents import requeue_orphans, scopes_for, spawn_processing

logger = logging.getLogger("ori.library")
router = APIRouter()
SCOPE_LABEL = {"mine": "Mi biblioteca", "common": "Biblioteca común", "both": "Mi biblioteca + Común"}
STOP = {"sobre", "trata", "carpeta", "curso", "documento", "documentos", "archivo", "archivos", "tienes", "puedes", "esta", "este", "donde"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in s if not unicodedata.combining(c)))


def _words(s: str):
    return {w for w in norm(s).split() if len(w) >= 4 and w not in STOP}


def _matches(name: str, text_norm: str, text_words: set) -> bool:
    n = norm(name).strip()
    if len(n) >= 4 and n in text_norm:
        return True
    w = _words(name)
    return len(w) >= 2 and len(w & text_words) >= max(2, round(len(w) * 0.6))


async def load_library(scopes: list):
    folders = {str(f["_id"]): f for f in await db.folders.find({"scope": {"$in": scopes}}).to_list(5000)}
    docs = await db.documents.find({"scope": {"$in": scopes}}, {"embedding": 0}).sort("file_name", 1).to_list(5000)

    def path(fid):
        parts, seen = [], set()
        while fid and fid in folders and fid not in seen:
            seen.add(fid)
            parts.append(folders[fid]["name"])
            fid = folders[fid].get("parent_id")
        return " / ".join(reversed(parts))

    for d in docs:
        d["path"] = path(d.get("folder_id"))
    return folders, docs, path


async def library_context(question: str, history: list, scopes: list):
    """Compact catalog + doc ids the user is naming (by folder or file name)."""
    folders, docs, path = await load_library(scopes)
    counts = {s: sum(1 for d in docs if d.get("status") == s) for s in ("ready", "processing", "error")}
    focus = []
    for text in [question] + [m["content"] for m in reversed(history) if m["role"] == "user"][:2]:
        tn, tw = norm(text), _words(text)
        hit_folders = {fid for fid, f in folders.items() if _matches(f["name"], tn, tw)}
        focus = [d for d in docs if d.get("status") == "ready" and (
            _matches(d["file_name"].rsplit(".", 1)[0], tn, tw) or
            any(fid in hit_folders for fid in _ancestors(d.get("folder_id"), folders)))]
        if focus:
            break
    firsts = {}
    ready_ids = [str(d["_id"]) for d in docs if d.get("status") == "ready"][:300]
    async for c in db.chunks.find({"doc_id": {"$in": ready_ids}, "kind": "doc", "idx": 0}, {"doc_id": 1, "text": 1}):
        firsts[c["doc_id"]] = re.sub(r"\s+", " ", c["text"])[:160]
    lines = []
    for d in docs[:300]:
        st = {"ready": "", "processing": " [procesando]", "error": " [error]"}.get(d.get("status"), "")
        tags = f" · etiquetas: {', '.join(d['tags'])}" if d.get("tags") else ""
        first = f" — «{firsts[str(d['_id'])]}»" if str(d["_id"]) in firsts else ""
        lines.append(f"- {d['path'] + ' / ' if d['path'] else ''}{d['file_name']}{st}{tags}{first}")
    catalog = "\n".join(lines)[:24000]
    return {"catalog": catalog, "counts": counts, "total": len(docs), "focus_ids": [str(d["_id"]) for d in focus][:40],
            "docs": [{"doc_id": str(d["_id"]), "file_name": d["file_name"]} for d in docs if d.get("status") == "ready"]}


def _ancestors(fid, folders):
    seen = []
    while fid and fid in folders and fid not in seen:
        seen.append(fid)
        fid = folders[fid].get("parent_id")
    return seen


@router.get("/library/status")
async def library_status(profile_id: Optional[str] = None):
    scopes = scopes_for("both", profile_id)
    by = {s: await db.documents.count_documents({"scope": {"$in": scopes}, "status": s}) for s in ("ready", "processing", "error")}
    return {**by, "chunks": await db.chunks.count_documents({}), "indexed": len(INDEX)}


@router.post("/library/reindex")
async def library_reindex(profile_id: Optional[str] = None):
    await sync_index(force=True)
    requeued = await requeue_orphans(reset=True)
    scopes = scopes_for("both", profile_id)
    async for d in db.documents.find({"scope": {"$in": scopes}, "status": "error", "has_original": True}, {"_id": 1}):
        await db.documents.update_one({"_id": d["_id"]}, {"$set": {"status": "processing", "error": None, "attempts": 0}})
        spawn_processing(str(d["_id"]))
        requeued += 1
    logger.info("Reindexado: %d fragmentos en el índice, %d documentos reencolados", len(INDEX), requeued)
    return {**(await library_status(profile_id)), "requeued": requeued}
