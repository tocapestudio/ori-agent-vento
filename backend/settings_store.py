import os

from deps import db

ENV_KEYS = {
    "llm_backend": "LLM_BACKEND",
    "gemini_api_key": "GEMINI_API_KEY",
    "gemini_model": "GEMINI_MODEL",
    "gemini_fallback_models": "GEMINI_FALLBACK_MODELS",
    "ollama_base_url": "OLLAMA_BASE_URL",
    "ollama_chat_model": "OLLAMA_CHAT_MODEL",
    "ollama_vision_model": "OLLAMA_VISION_MODEL",
}


async def get_llm_settings() -> dict:
    settings = {k: os.environ[v] for k, v in ENV_KEYS.items()}
    saved = await db.settings.find_one({"_id": "llm"}) or {}
    settings.update({k: v for k, v in saved.items() if k in ENV_KEYS and v not in (None, "")})
    return settings


async def save_llm_settings(changes: dict):
    if changes:
        await db.settings.update_one({"_id": "llm"}, {"$set": changes}, upsert=True)


def public_settings(s: dict) -> dict:
    out = {k: v for k, v in s.items() if k != "gemini_api_key"}
    key = s.get("gemini_api_key") or ""
    out["gemini_api_key_set"] = bool(key)
    out["gemini_api_key_hint"] = f"…{key[-4:]}" if key else ""
    return out
