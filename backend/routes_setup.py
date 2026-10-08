import asyncio
import ipaddress
import json
import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from auth import get_auth_doc, hash_code, make_token
from deps import db
from models import now_iso
from settings_store import save_llm_settings

public = APIRouter()
router = APIRouter()
NOWIN = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class SetupIn(BaseModel):
    access_code: str = Field(min_length=6, max_length=100)
    gemini_api_key: Optional[str] = None


async def needs_setup() -> bool:
    return os.environ.get("ORI_SETUP_WIZARD") == "1" and not await db.settings.find_one({"_id": "setup"})


@public.get("/setup/status")
async def setup_status():
    return {"needs_setup": await needs_setup()}


@public.post("/setup/complete")
async def setup_complete(body: SetupIn):
    if not await needs_setup():
        raise HTTPException(409, "La configuración inicial ya se completó")
    version = (await get_auth_doc())["version"] + 1
    await db.settings.update_one({"_id": "auth"}, {"$set": {"code_hash": hash_code(body.access_code), "version": version}})
    if body.gemini_api_key and body.gemini_api_key.strip():
        await save_llm_settings({"gemini_api_key": body.gemini_api_key.strip()})
    await db.settings.insert_one({"_id": "setup", "done_at": now_iso()})
    return {"token": make_token(version)}


def _tailscale_name():
    exe = shutil.which("tailscale") or next((p for p in (r"C:\Program Files\Tailscale\tailscale.exe",) if os.path.exists(p)), None)
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "status", "--json"], capture_output=True, text=True, timeout=5, creationflags=NOWIN)
        return json.loads(out.stdout)["Self"]["DNSName"].rstrip(".") or None
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        return None


def _local_ips():
    ips = set()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.add(s.getsockname()[0])
    except OSError:
        pass
    try:
        ips.update(i[4][0] for i in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
    except OSError:
        pass
    return {ip for ip in ips if not ip.startswith("127.")}


@router.get("/system/network")
async def network():
    ips = await asyncio.to_thread(_local_ips)
    cgnat = ipaddress.ip_network("100.64.0.0/10")
    ts = sorted(ip for ip in ips if ipaddress.ip_address(ip) in cgnat)
    lan = sorted(ip for ip in ips if ip not in ts and ipaddress.ip_address(ip).is_private)
    return {"port": os.environ.get("ORI_PORT"), "lan": lan, "tailscale_ips": ts,
            "tailscale_name": await asyncio.to_thread(_tailscale_name), "hostname": socket.gethostname(),
            "can_shutdown": bool(os.environ.get("ORI_LAUNCHER"))}


@router.post("/system/shutdown")
async def shutdown():
    launcher = os.environ.get("ORI_LAUNCHER")
    if not launcher:
        raise HTTPException(400, "Solo disponible en la versión instalada en Windows")
    subprocess.Popen([sys.executable, launcher, "--stop", "--quiet"], creationflags=NOWIN)
    return {"ok": True}


def _downloads_dir() -> Path:
    return Path(os.environ["DOWNLOADS_DIR"])


@router.get("/downloads")
async def list_downloads():
    d = _downloads_dir()
    if not d.is_dir():
        return []
    return [{"name": p.name, "size": p.stat().st_size} for p in sorted(d.iterdir()) if p.is_file() and not p.name.startswith(".")]


@router.get("/downloads/{name}")
async def get_download(name: str):
    p = _downloads_dir() / name
    if "/" in name or "\\" in name or name.startswith(".") or not p.is_file():
        raise HTTPException(404, "Archivo no encontrado")
    return FileResponse(p, filename=name)
