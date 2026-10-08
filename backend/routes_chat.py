import asyncio
import json
import logging
import re

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

import llm
from deps import db
from models import ChatRequest, ConversationRecord, ConversationRename, MessageRecord, now_iso
from prompts import SYSTEM_PROMPT, build_user_prompt
from library import SCOPE_LABEL, library_context
from retrieval import hybrid_search
from routes_documents import oid, scopes_for
from routes_extras import get_visible_template
from websearch import web_search

router = APIRouter()
logger = logging.getLogger("ori.chat")


DISCLAIMER_RE = re.compile(r"(?:^|\n)[ \t>*_-]*([^\n]*(?:herramienta de apoyo|juicio cl[ií]nico)[^\n]*)\s*$", re.IGNORECASE)


def split_disclaimer(answer: str):
    m = DISCLAIMER_RE.search(answer.rstrip())
    if not m:
        return answer, None
    return answer[:m.start()].rstrip(), m.group(1).strip(" *_")


def extract_sources(answer: str, hits: list, web, catalog_docs=None):
    doc_sources, seen = [], set()
    for group in re.findall(r"\[([^\[\]]{3,250})\]", answer):
        low = group.lower()
        cands = [h for h in hits if h["file_name"].lower() in low]
        if not cands:
            d = next((d for d in catalog_docs or [] if d["file_name"].lower() in low), None)
            if d and (d["doc_id"], group) not in seen:
                seen.add((d["doc_id"], group))
                doc_sources.append({"doc_id": d["doc_id"], "file_name": d["file_name"], "ref": group.split(",", 1)[-1].strip(),
                                    "kind": "doc", "page": None, "cite": group, "snippet": ""})
            continue
        h = next((c for c in cands if c["ref"].lower() in low), cands[0])
        page = re.search(r"p\.\s*(\d+)", h["ref"])
        src = {"doc_id": h["doc_id"], "file_name": h["file_name"], "ref": h["ref"], "kind": h.get("kind", "doc"),
               "page": int(page.group(1)) if page else None, "cite": group, "snippet": h["text"][:300]}
        if (h["doc_id"], h["ref"], group) not in seen:
            seen.add((h["doc_id"], h["ref"], group))
            doc_sources.append(src)
    web = web or []
    cited = {int(n) for g in re.findall(r"\[([^\[\]]*W\d+[^\[\]]*)\]", answer) for n in re.findall(r"W(\d+)", g)}
    picked = [i for i, w in enumerate(web) if (i + 1) in cited or w["url"] in answer]
    if web and not picked and re.search(r"fuente web|información de internet", answer, re.I):
        picked = list(range(len(web)))
    web_sources = [{"label": f"W{i + 1}", "title": web[i]["title"], "url": web[i]["url"], "snippet": web[i]["snippet"][:300]}
                   for i in picked]
    return doc_sources, web_sources


async def gather_hits(question: str, scopes: list, focus_ids: list, k: int = 8):
    if not focus_ids:
        return await hybrid_search(question, scopes, k)
    focused = await hybrid_search(question, scopes, k, doc_ids=focus_ids)
    seen = {h["id"] for h in focused}
    firsts = await db.chunks.find({"doc_id": {"$in": focus_ids[:8]}, "kind": "doc", "idx": 0}, {"embedding": 0}).to_list(8)
    for c in firsts:
        cid = str(c.pop("_id"))
        if cid not in seen:
            seen.add(cid)
            focused.append({**c, "id": cid, "score": 0, "dense": 0})
    general = [h for h in await hybrid_search(question, scopes, 4) if h["id"] not in seen]
    logger.info("chat: %d documentos enfocados por nombre/carpeta, %d fragmentos", len(focus_ids), len(focused))
    return (focused + general)[:14]


_TITLE_TASKS = set()


async def auto_title(conv_id: str, question: str):
    try:
        raw = await llm.complete("Generas títulos muy breves en español.",
                                 "Escribe un título de 3 a 6 palabras, sin comillas ni punto final, que resuma esta "
                                 f"consulta clínica (sin datos personales):\n{question[:1500]}", retries=2, base_delay=2)
        title = raw.strip().strip('"«»').splitlines()[0][:70] if raw.strip() else ""
        if title:
            await db.conversations.update_one({"_id": ObjectId(conv_id)}, {"$set": {"title": title}})
    except Exception as e:
        logger.warning("auto title failed: %s", e)


def spawn_title(conv_id: str, question: str):
    t = asyncio.create_task(auto_title(conv_id, question))
    _TITLE_TASKS.add(t)
    t.add_done_callback(_TITLE_TASKS.discard)


async def run_chat(req: ChatRequest):
    if req.conversation_id:
        conv = await db.conversations.find_one({"_id": oid(req.conversation_id)})
        if not conv:
            raise HTTPException(404, "Conversación no encontrada")
        if conv["profile_id"] != req.profile_id:
            raise HTTPException(403, "Solo puedes escribir en tus propias conversaciones")
        conv_id = req.conversation_id
    else:
        words = req.question.strip().split()
        fallback = " ".join(words[:8]) + ("…" if len(words) > 8 else "")
        rec = ConversationRecord(profile_id=req.profile_id, title=fallback[:70] or "Nueva conversación")
        conv_id = str((await db.conversations.insert_one(rec.to_mongo())).inserted_id)
        spawn_title(conv_id, req.question)
    scopes = scopes_for(req.scope, req.profile_id)
    template = await get_visible_template(req.template_id, req.profile_id) if req.template_id else None

    async def events():
        yield {"type": "meta", "conversation_id": conv_id}
        hist = await db.messages.find({"conversation_id": conv_id}).sort("created_at", -1).to_list(8)
        history = [{"role": m["role"], "content": m["content"]} for m in reversed(hist)]
        lib = await library_context(req.question, history, scopes)
        hits = await gather_hits(req.question, scopes, lib["focus_ids"])
        lib["scope_label"] = SCOPE_LABEL[req.scope]
        web = None
        if req.web_search:
            yield {"type": "status", "message": "Buscando en internet…"}
            web = await asyncio.to_thread(web_search, req.question)
        yield {"type": "status", "message": "Ori está pensando…", "retrieved": len(hits)}
        answer = ""
        try:
            async for t in llm.stream(SYSTEM_PROMPT, build_user_prompt(req.question, history, hits, web, template, lib)):
                answer += t
                yield {"type": "delta", "text": t}
        except llm.LLMError as e:
            logger.warning("Chat LLM error (%s): %s", e.status, e.message)
            if not history:
                await db.conversations.delete_one({"_id": ObjectId(conv_id)})
            yield {"type": "error", "message": e.message, "status": e.status}
            return
        answer, disclaimer = split_disclaimer(answer)
        doc_sources, web_sources = extract_sources(answer, hits, web, lib["docs"])
        found = template is not None or bool(doc_sources)
        user_msg = MessageRecord(conversation_id=conv_id, role="user", content=req.question, scope=req.scope,
                                 web_search=req.web_search, template_name=template.name if template else None)
        bot_msg = MessageRecord(conversation_id=conv_id, role="assistant", content=answer, scope=req.scope,
                                web_search=req.web_search, found_in_docs=found, doc_sources=doc_sources,
                                web_sources=web_sources, disclaimer=disclaimer)
        await db.messages.insert_one(user_msg.to_mongo())
        res = await db.messages.insert_one(bot_msg.to_mongo())
        await db.conversations.update_one({"_id": ObjectId(conv_id)},
                                          {"$set": {"updated_at": now_iso()}, "$inc": {"message_count": 2}})
        yield {"type": "done", "conversation_id": conv_id, "message_id": str(res.inserted_id), "answer": answer,
               "found_in_docs": found, "doc_sources": doc_sources, "web_sources": web_sources, "disclaimer": disclaimer,
               "web_search_used": req.web_search, "retrieved": len(hits)}

    return events()


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    events = await run_chat(req)

    async def sse():
        async for ev in events:
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/chat")
async def chat(req: ChatRequest):
    final = None
    async for ev in await run_chat(req):
        if ev["type"] == "error":
            raise HTTPException(ev["status"], ev["message"])
        if ev["type"] == "done":
            final = ev
    return final


@router.get("/conversations")
async def list_conversations(profile_id: str):
    convs = await db.conversations.find({"profile_id": profile_id}).sort("updated_at", -1).to_list(500)
    return [ConversationRecord.from_mongo(c) for c in convs]


@router.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str):
    conv = await db.conversations.find_one({"_id": oid(conv_id)})
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")
    msgs = await db.messages.find({"conversation_id": conv_id}).sort("created_at", 1).to_list(1000)
    return {"conversation": ConversationRecord.from_mongo(conv), "messages": [MessageRecord.from_mongo(m) for m in msgs]}


async def owned_conversation(conv_id: str, profile_id: str):
    conv = await db.conversations.find_one({"_id": oid(conv_id)})
    if not conv:
        raise HTTPException(404, "Conversación no encontrada")
    if conv["profile_id"] != profile_id:
        raise HTTPException(403, "Solo el perfil propietario puede modificar esta conversación")
    return conv


@router.patch("/conversations/{conv_id}")
async def rename_conversation(conv_id: str, body: ConversationRename):
    await owned_conversation(conv_id, body.profile_id)
    await db.conversations.update_one({"_id": oid(conv_id)}, {"$set": {"title": body.title.strip()[:100]}})
    return {"ok": True}


@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, profile_id: str):
    await owned_conversation(conv_id, profile_id)
    await db.conversations.delete_one({"_id": oid(conv_id)})
    await db.messages.delete_many({"conversation_id": conv_id})
    await db.favorites.delete_many({"conversation_id": conv_id})
    return {"deleted": conv_id}
