import asyncio
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from fastapi import APIRouter, Depends, FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from auth import require_team, seed_access_code  # noqa: E402
from deps import client, db  # noqa: E402
from retrieval import get_model, sync_index  # noqa: E402
from routes_chat import router as chat_router  # noqa: E402
from routes_core import public as public_router  # noqa: E402
from routes_core import router as core_router  # noqa: E402
from routes_documents import requeue_orphans, watchdog  # noqa: E402
from library import router as library_router  # noqa: E402
from routes_documents import router as docs_router  # noqa: E402
from routes_folders import router as folders_router  # noqa: E402
from routes_extras import router as extras_router, seed_templates  # noqa: E402
from routes_cheatsheets import router as cheats_router  # noqa: E402
from routes_order import router as order_router  # noqa: E402
from routes_backup import router as backup_router  # noqa: E402
from routes_setup import public as setup_public, router as setup_router  # noqa: E402
from autobackup import router as autobackup_router, startup_backup  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ori")

app = FastAPI(title="Ori API", openapi_url="/api/openapi.json", docs_url="/api/docs")

api = APIRouter(prefix="/api")
api.include_router(public_router)
api.include_router(setup_public)
protected = APIRouter(dependencies=[Depends(require_team)])
for r in (core_router, library_router, folders_router, extras_router, cheats_router, order_router, backup_router, autobackup_router, setup_router, docs_router, chat_router):
    protected.include_router(r)
api.include_router(protected)
app.include_router(api)

FRONTEND_DIR = os.environ.get("FRONTEND_DIR")
if FRONTEND_DIR:
    from fastapi import HTTPException  # noqa: E402
    from fastapi.responses import FileResponse  # noqa: E402

    _front = Path(FRONTEND_DIR).resolve()

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "No encontrado")
        f = (_front / path).resolve()
        return FileResponse(f if path and f.is_file() and _front in f.parents else _front / "index.html")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_access_code()
    await seed_templates()
    await db.favorites.create_index([("conversation_id", 1), ("saved_by", 1)])
    await db.chunks.create_index("doc_id")
    await db.chunks.create_index("scope")
    await db.chunks.create_index([("text", "text")], default_language="spanish", name="text_es")
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    await db.conversations.create_index([("profile_id", 1), ("updated_at", -1)])
    await db.folders.create_index([("scope", 1), ("parent_id", 1)])
    live = [str(d["_id"]) for d in await db.documents.find({}, {"_id": 1}).to_list(100000)]
    await db.chunks.delete_many({"doc_id": {"$nin": live}})
    await sync_index()
    await asyncio.to_thread(get_model)
    logger.info("Reencolados al arrancar: %d documentos", await requeue_orphans())
    for coro in (startup_backup(), watchdog()):
        task = asyncio.create_task(coro)
        _BG.add(task)
        task.add_done_callback(_BG.discard)


_BG = set()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
