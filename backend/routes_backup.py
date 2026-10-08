import asyncio
import json
import os
import shutil
import tempfile
import zipfile

from bson import json_util
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pymongo import ReplaceOne
from starlette.background import BackgroundTask

from deps import db
from models import now_iso
from retrieval import sync_index
from routes_documents import STORAGE

router = APIRouter()
COLLECTIONS = ["profiles", "folders", "documents", "chunks", "conversations", "messages",
               "cheatsheets", "templates", "favorites", "orders", "settings"]
VERSION = 1


def _strip_secret(name: str, doc: dict) -> dict:
    if name == "settings" and doc.get("_id") == "llm":
        doc.pop("gemini_api_key", None)
    return doc


@router.get("/backup/export")
async def export_backup():
    fd, tmp = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    await write_backup_zip(tmp)
    stamp = now_iso()[:16].replace(":", "").replace("-", "")
    return FileResponse(tmp, media_type="application/zip", filename=f"ori-copia-{stamp}.zip",
                        background=BackgroundTask(os.remove, tmp))


async def write_backup_zip(path):
    counts = {}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name in COLLECTIONS:
            lines = [json_util.dumps(_strip_secret(name, d)) async for d in db[name].find({})
                     if not (name == "settings" and d["_id"] == "autobackup")]
            counts[name] = len(lines)
            z.writestr(f"collections/{name}.jsonl", "\n".join(lines))
        files = [p for p in STORAGE.iterdir() if p.is_file()]
        for p in files:
            await asyncio.to_thread(z.write, p, f"files/{p.name}")
        counts["files"] = len(files)
        z.writestr("manifest.json", json.dumps({"app": "ori", "version": VERSION, "created_at": now_iso(), "counts": counts}))
    return counts


def _read(path: str):
    with zipfile.ZipFile(path) as z:
        names = set(z.namelist())
        if "manifest.json" not in names:
            raise HTTPException(400, "El archivo no es una copia de seguridad de Ori")
        manifest = json.loads(z.read("manifest.json"))
        if manifest.get("app") != "ori" or manifest.get("version") != VERSION:
            raise HTTPException(400, "Versión de copia de seguridad no compatible")
        data = {}
        for name in COLLECTIONS:
            raw = z.read(f"collections/{name}.jsonl").decode() if f"collections/{name}.jsonl" in names else ""
            data[name] = [json_util.loads(line) for line in raw.splitlines() if line.strip()]
        files = [n for n in names if n.startswith("files/") and n.count("/") == 1 and len(n) > 6 and ".." not in n]
    return manifest, data, files


def _extract(path: str, files: list, replace: bool):
    if replace:
        for p in STORAGE.iterdir():
            if p.is_file():
                p.unlink()
    with zipfile.ZipFile(path) as z:
        for n in files:
            with z.open(n) as src, open(STORAGE / n[6:], "wb") as dst:
                shutil.copyfileobj(src, dst)


@router.post("/backup/import")
async def import_backup(file: UploadFile = File(...), mode: str = Form("merge")):
    if mode not in ("replace", "merge"):
        raise HTTPException(400, "Modo de importación no válido")
    fd, tmp = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    try:
        with open(tmp, "wb") as out:
            while chunk := await file.read(1 << 20):
                out.write(chunk)
        try:
            manifest, data, files = await asyncio.to_thread(_read, tmp)
        except zipfile.BadZipFile as e:
            raise HTTPException(400, "El archivo no es un .zip válido") from e
        key = (await db.settings.find_one({"_id": "llm"}) or {}).get("gemini_api_key")
        for name, docs in data.items():
            col = db[name]
            if mode == "replace":
                await col.delete_many({})
            elif name == "settings":
                docs = [d for d in docs if d["_id"] not in ("auth", "autobackup")]
            for i in range(0, len(docs), 1000):
                batch = docs[i:i + 1000]
                if mode == "replace":
                    await col.insert_many(batch)
                else:
                    await col.bulk_write([ReplaceOne({"_id": d["_id"]}, d, upsert=True) for d in batch])
        if key:
            await db.settings.update_one({"_id": "llm"}, {"$set": {"gemini_api_key": key}}, upsert=True)
        await asyncio.to_thread(_extract, tmp, files, mode == "replace")
        await sync_index(force=True)
        return {"mode": mode, "restored": {n: len(d) for n, d in data.items()}, "files": len(files),
                "backup_created_at": manifest.get("created_at")}
    finally:
        os.remove(tmp)
