import asyncio
import logging
import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from deps import db
from models import now_iso
from routes_backup import write_backup_zip

router = APIRouter()
logger = logging.getLogger("ori.autobackup")
LOCK = asyncio.Lock()
KEEP_DAYS = 3
NAME_RE = re.compile(r"^ori-backup-(\d{4}-\d{2}-\d{2})_(\d{4})\.zip$")


class AutoIn(BaseModel):
    enabled: bool


def backup_dir() -> Path:
    return Path(os.environ["BACKUP_DIR"])


def _file_date(p: Path) -> date:
    m = NAME_RE.match(p.name)
    return date.fromisoformat(m.group(1)) if m else datetime.fromtimestamp(p.stat().st_mtime).date()


def list_backups():
    d = backup_dir()
    if not d.is_dir():
        return []
    files = sorted((p for p in d.glob("ori-backup-*.zip") if p.is_file()), key=lambda p: p.name, reverse=True)
    return [{"name": p.name, "size": p.stat().st_size, "date": _file_date(p).isoformat()} for p in files]


def prune(keep: Path) -> list:
    cutoff = date.today() - timedelta(days=KEEP_DAYS - 1)
    deleted = []
    for p in backup_dir().glob("ori-backup-*.zip"):
        if p != keep and _file_date(p) < cutoff:
            p.unlink()
            deleted.append(p.name)
    return deleted


async def get_state() -> dict:
    return await db.settings.find_one({"_id": "autobackup"}) or {"enabled": True}


async def run_backup(reason: str) -> dict:
    if LOCK.locked():
        return {"status": "running"}
    async with LOCK:
        d = backup_dir()
        name = f"ori-backup-{datetime.now():%Y-%m-%d_%H%M}.zip"
        final, tmp = d / name, d / f".{name}.tmp"
        try:
            d.mkdir(parents=True, exist_ok=True)
            await write_backup_zip(tmp)
            os.replace(tmp, final)
        except Exception as e:  # noqa: BLE001 - any failure must be recorded and shown to the user
            logger.exception("Automatic backup failed")
            last = {"at": now_iso(), "status": "error", "error": str(e)[:300], "reason": reason}
            await db.settings.update_one({"_id": "autobackup"}, {"$set": {"last": last}}, upsert=True)
            return last
        finally:
            tmp.unlink(missing_ok=True)
        deleted = prune(final)
        last = {"at": now_iso(), "status": "ok", "file": name, "size": final.stat().st_size, "reason": reason, "deleted": deleted}
        await db.settings.update_one({"_id": "autobackup"}, {"$set": {"last": last}}, upsert=True)
        return last


async def startup_backup():
    await asyncio.sleep(20)
    if not (await get_state()).get("enabled", True):
        return
    today = date.today().isoformat()
    if any(b["date"] == today for b in list_backups()):
        return
    await run_backup("inicio")


@router.get("/backup/auto")
async def auto_status():
    s = await get_state()
    return {"enabled": s.get("enabled", True), "keep_days": KEEP_DAYS, "dir": str(backup_dir()),
            "running": LOCK.locked(), "last": s.get("last"), "backups": list_backups()}


@router.put("/backup/auto")
async def auto_update(body: AutoIn):
    await db.settings.update_one({"_id": "autobackup"}, {"$set": {"enabled": body.enabled}}, upsert=True)
    return await auto_status()


@router.post("/backup/auto/run-now")
async def auto_run_now():
    res = await run_backup("manual")
    if res["status"] == "running":
        raise HTTPException(409, "Ya se está haciendo una copia")
    return res


@router.get("/backup/auto/files/{name}")
async def auto_file(name: str):
    p = backup_dir() / name
    if not NAME_RE.match(name) or not p.is_file():
        raise HTTPException(404, "Copia no encontrada")
    return FileResponse(p, media_type="application/zip", filename=name)
