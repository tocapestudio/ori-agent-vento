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
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "anthropic_model": "ANTHROPIC_MODEL",
    "openai_base_url": "OPENAI_BASE_URL",
    "openai_api_key": "OPENAI_API_KEY",
    "openai_model": "OPENAI_MODEL",
}

# Valores por defecto para las claves que no existían en instalaciones antiguas (.env sin ellas).
DEFAULTS = {
    "anthropic_api_key": "",
    "anthropic_model": "claude-sonnet-5-5",
    "openai_base_url": "https://openrouter.ai/api/v1",
    "openai_api_key": "",
    "openai_model": "",
}

SECRET_KEYS = ("gemini_api_key", "anthropic_api_key", "openai_api_key")


async def get_llm_settings() -> dict:
    settings = {k: os.environ.get(v, DEFAULTS.get(k, "")) for k, v in ENV_KEYS.items()}
    saved = await db.settings.find_one({"_id": "llm"}) or {}
    settings.update({k: v for k, v in saved.items() if k in ENV_KEYS and v not in (None, "")})
    return settings


async def save_llm_settings(changes: dict):
    if changes:
        await db.settings.update_one({"_id": "llm"}, {"$set": changes}, upsert=True)


def public_settings(s: dict) -> dict:
    out = {k: v for k, v in s.items() if k not in SECRET_KEYS}
    for name in SECRET_KEYS:
        key = s.get(name) or ""
        out[f"{name}_set"] = bool(key)
        out[f"{name}_hint"] = f"…{key[-4:]}" if key else ""
    return out
