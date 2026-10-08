from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException

from deps import db
from models import FolderIn, FolderRecord, FolderUpdate, MoveIn
from routes_documents import library_scope, oid

router = APIRouter()


async def get_folder(folder_id: str) -> FolderRecord:
    f = await db.folders.find_one({"_id": oid(folder_id)})
    if not f:
        raise HTTPException(404, "Carpeta no encontrada")
    return FolderRecord.from_mongo(f)


async def check_target(folder_id: Optional[str], scope: str):
    if folder_id and (await get_folder(folder_id)).scope != scope:
        raise HTTPException(400, "Solo se puede mover dentro de la misma biblioteca")


@router.get("/folders")
async def list_folders(library: str = "common", profile_id: Optional[str] = None):
    folders = await db.folders.find({"scope": library_scope(library, profile_id)}).sort("name", 1).to_list(5000)
    return [FolderRecord.from_mongo(f) for f in folders]


@router.post("/folders", response_model=FolderRecord)
async def create_folder(body: FolderIn):
    scope = library_scope(body.library, body.profile_id)
    await check_target(body.parent_id, scope)
    rec = FolderRecord(name=body.name.strip(), scope=scope, parent_id=body.parent_id)
    rec.id = str((await db.folders.insert_one(rec.to_mongo())).inserted_id)
    return rec


@router.patch("/folders/{folder_id}", response_model=FolderRecord)
async def update_folder(folder_id: str, body: FolderUpdate):
    folder = await get_folder(folder_id)
    changes = {}
    if body.name:
        changes["name"] = body.name.strip()
    if body.move_to_root:
        changes["parent_id"] = None
    elif body.parent_id:
        await check_target(body.parent_id, folder.scope)
        cursor = body.parent_id
        while cursor:
            if cursor == folder_id:
                raise HTTPException(400, "No puedes mover una carpeta dentro de sí misma")
            cursor = (await get_folder(cursor)).parent_id
        changes["parent_id"] = body.parent_id
    if changes:
        await db.folders.update_one({"_id": ObjectId(folder_id)}, {"$set": changes})
    return await get_folder(folder_id)


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str):
    folder = await get_folder(folder_id)
    moved_docs = await db.documents.update_many({"folder_id": folder_id}, {"$set": {"folder_id": folder.parent_id}})
    moved_folders = await db.folders.update_many({"parent_id": folder_id}, {"$set": {"parent_id": folder.parent_id}})
    await db.folders.delete_one({"_id": ObjectId(folder_id)})
    return {"deleted": folder_id, "moved_documents": moved_docs.modified_count,
            "moved_folders": moved_folders.modified_count, "parent_id": folder.parent_id}


@router.post("/documents/{doc_id}/move")
async def move_document(doc_id: str, body: MoveIn):
    d = await db.documents.find_one({"_id": oid(doc_id)})
    if not d:
        raise HTTPException(404, "Documento no encontrado")
    await check_target(body.folder_id, d["scope"])
    await db.documents.update_one({"_id": d["_id"]}, {"$set": {"folder_id": body.folder_id}})
    return {"id": doc_id, "folder_id": body.folder_id}
