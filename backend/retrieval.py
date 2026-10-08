import asyncio
import logging
import os
import re

from bson import ObjectId
from fastembed import TextEmbedding

from deps import db
from vector_index import VectorIndex

logger = logging.getLogger("ori.retrieval")
_model = None
INDEX = VectorIndex(os.environ["INDEX_DIR"])


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(os.environ["EMBED_MODEL"], cache_dir=os.environ["EMBED_CACHE_DIR"])
    return _model


def embed(texts):
    return [v.tolist() for v in get_model().embed(texts)]


async def index_chunks(chunk_ids, docs, vectors):
    entries = [{"chunk_id": str(cid), "doc_id": d["doc_id"], "scope": d["scope"]} for cid, d in zip(chunk_ids, docs)]
    await asyncio.to_thread(INDEX.add, entries, vectors)


async def unindex(doc_id: str = None, chunk_ids=None):
    ids = {str(c) for c in chunk_ids or []}
    await asyncio.to_thread(INDEX.remove, lambda m: m["doc_id"] == doc_id or m["chunk_id"] in ids)


async def sync_index(force: bool = False):
    """Rebuild the on-disk index from Mongo if it is out of sync."""
    total = await db.chunks.count_documents({})
    if not force and total == len(INDEX):
        return
    entries, vectors = [], []
    async for c in db.chunks.find({}, {"doc_id": 1, "scope": 1, "embedding": 1}):
        entries.append({"chunk_id": str(c["_id"]), "doc_id": c["doc_id"], "scope": c["scope"]})
        vectors.append(c["embedding"])
    await asyncio.to_thread(INDEX.reset, entries, vectors)


async def update_scope_in_index(doc_id: str, scope: str):
    def _apply():
        with INDEX.lock:
            for m in INDEX.meta:
                if m["doc_id"] == doc_id:
                    m["scope"] = scope
            INDEX._save()
    await asyncio.to_thread(_apply)


async def _dense(query, scopes, doc_ids):
    qv = (await asyncio.to_thread(embed, [query]))[0]
    if doc_ids is None:
        return await asyncio.to_thread(INDEX.search, qv, set(scopes), 40)
    ids = set(doc_ids)
    pool = await asyncio.to_thread(INDEX.search, qv, set(scopes), 4000)
    allowed = {str(c["_id"]) for c in await db.chunks.find({"doc_id": {"$in": list(ids)}}, {"_id": 1}).to_list(20000)}
    return [p for p in pool if p[0] in allowed][:40]


async def _sparse(query, flt):
    try:
        return await db.chunks.find({**flt, "$text": {"$search": query}}, {"score": {"$meta": "textScore"}, "_id": 1}) \
            .sort([("score", {"$meta": "textScore"})]).limit(40).to_list(40)
    except Exception as e:  # noqa: BLE001 - missing text index: fall back to keyword regex
        logger.warning("Búsqueda de texto falló (%r); usando búsqueda por palabras", e)
        words = [re.escape(w) for w in re.findall(r"\w{4,}", query)][:8]
        if not words:
            return []
        return await db.chunks.find({**flt, "text": {"$regex": "|".join(words), "$options": "i"}}, {"_id": 1}).limit(40).to_list(40)


async def hybrid_search(query: str, scopes: list, k: int = 8, doc_ids=None):
    flt = {"scope": {"$in": scopes}, **({"doc_id": {"$in": list(doc_ids)}} if doc_ids is not None else {})}
    try:
        dense = await _dense(query, scopes, doc_ids)
    except Exception:  # noqa: BLE001 - vector search must never silently zero the results
        logger.exception("Búsqueda vectorial falló; continúo solo con texto")
        dense = []
    sparse = await _sparse(query, flt)
    logger.info("búsqueda: ámbitos=%s fragmentos_en_ámbito=%d índice=%d vectorial=%d texto=%d filtro_docs=%s",
                scopes, await db.chunks.count_documents(flt), len(INDEX), len(dense), len(sparse),
                None if doc_ids is None else len(doc_ids))

    fused, dense_score = {}, {}
    for rank, (cid, score) in enumerate(dense):
        fused[cid] = fused.get(cid, 0) + 1 / (60 + rank)
        dense_score[cid] = score
    for rank, d in enumerate(sparse):
        cid = str(d["_id"])
        fused[cid] = fused.get(cid, 0) + 1 / (60 + rank)
    top = sorted(fused, key=fused.get, reverse=True)[:k]
    if not top:
        return []
    docs = await db.chunks.find({"_id": {"$in": [ObjectId(c) for c in top]}}, {"embedding": 0}).to_list(k)
    by_id = {str(d["_id"]): d for d in docs}
    out = []
    for cid in top:
        if cid in by_id:
            d = by_id[cid]
            d["id"] = cid
            d.pop("_id")
            d.update(score=round(fused[cid], 5), dense=round(dense_score.get(cid, 0.0), 4))
            out.append(d)
    return out
