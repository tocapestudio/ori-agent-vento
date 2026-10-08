"""LLM provider layer: 'gemini' (google-genai, user's own key) or 'ollama' (local). Selected via Settings/env."""
import asyncio
import base64
import json
import logging
from typing import AsyncIterator, List, Optional

import httpx
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from settings_store import get_llm_settings

logger = logging.getLogger("ori.llm")

RATE_MSG = "Ori está descansando un momento (límite gratuito alcanzado), inténtalo en unos segundos."
BUSY_MSG = "El modelo de IA está saturado ahora mismo. Inténtalo de nuevo en unos segundos."
RETRY_CODES = {429, 500, 503, 504}
GEMINI_TIMEOUT_MS = 120_000

OCR_PROMPT = (
    "Actúa como motor OCR. Transcribe literalmente TODO el texto visible en esta imagen, "
    "respetando el idioma original, números, unidades y acentos. Mantén las tablas como filas "
    "con separadores ' | '. Si hay figuras o gráficos, descríbelos brevemente entre [corchetes]. "
    "Devuelve únicamente la transcripción, sin comentarios."
)


class LLMError(Exception):
    def __init__(self, message: str, status: int = 503):
        super().__init__(message)
        self.message, self.status = message, status


class GeminiProvider:
    def __init__(self, s: dict, retries: int, base_delay: float):
        if not s["gemini_api_key"]:
            raise LLMError("Falta la clave de Gemini. Añádela en Ajustes.", 400)
        self.key = s["gemini_api_key"]
        fallbacks = [m.strip() for m in s["gemini_fallback_models"].split(",") if m.strip()]
        self.models = [s["gemini_model"]] + [m for m in fallbacks if m != s["gemini_model"]]
        self.retries, self.base_delay = retries, base_delay

    async def _once(self, model, system, text, images):
        client = genai.Client(api_key=self.key, http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS))
        parts = [types.Part.from_bytes(data=p, mime_type="image/png") for p in images or []] + [text]
        cfg = types.GenerateContentConfig(system_instruction=system, temperature=0.3,
                                          automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
        async for chunk in await client.aio.models.generate_content_stream(model=model, contents=parts, config=cfg):
            if chunk.text:
                yield chunk.text

    async def stream(self, system, text, images=None) -> AsyncIterator[str]:
        last_code = None
        for model in self.models:
            for attempt in range(self.retries):
                started = False
                try:
                    async for t in self._once(model, system, text, images):
                        started = True
                        yield t
                    return
                except genai_errors.APIError as e:
                    logger.warning("Gemini %s error %s (intento %d, started=%s): %s", model, e.code, attempt + 1, started, e.message)
                    if started and e.code in RETRY_CODES:
                        raise LLMError(RATE_MSG if e.code == 429 else BUSY_MSG, e.code if e.code == 429 else 503)
                    if e.code not in RETRY_CODES:
                        raise LLMError(f"Error del proveedor Gemini ({e.code}): {e.message}", 502)
                    last_code = e.code
                    await asyncio.sleep(self.base_delay * (2 ** attempt))
                except (httpx.HTTPError, asyncio.TimeoutError) as e:
                    logger.warning("Gemini %s network error: %r", model, e)
                    if started:
                        raise LLMError(BUSY_MSG, 503)
                    last_code = 503
                    await asyncio.sleep(self.base_delay * (2 ** attempt))
        raise LLMError(RATE_MSG, 429) if last_code == 429 else LLMError(BUSY_MSG, 503)


class OllamaProvider:
    def __init__(self, s: dict, *_):
        self.url = s["ollama_base_url"].rstrip("/")
        self.chat_model, self.vision_model = s["ollama_chat_model"], s["ollama_vision_model"]

    async def stream(self, system, text, images=None) -> AsyncIterator[str]:
        user = {"role": "user", "content": text}
        if images:
            user["images"] = [base64.b64encode(p).decode() for p in images]
        payload = {"model": self.vision_model if images else self.chat_model, "stream": True,
                   "messages": [{"role": "system", "content": system}, user]}
        try:
            async with httpx.AsyncClient(timeout=600) as c:
                async with c.stream("POST", f"{self.url}/api/chat", json=payload) as r:
                    if r.status_code >= 400:
                        raise LLMError(f"Ollama devolvió {r.status_code}: {(await r.aread())[:200]!r}", 502)
                    async for line in r.aiter_lines():
                        if line:
                            t = json.loads(line).get("message", {}).get("content")
                            if t:
                                yield t
        except httpx.HTTPError as e:
            raise LLMError(f"No se puede conectar con Ollama en {self.url}: {e}", 503)


PROVIDERS = {"gemini": GeminiProvider, "ollama": OllamaProvider}


async def get_provider(retries: int = 2, base_delay: float = 2.0):
    s = await get_llm_settings()
    return PROVIDERS[s["llm_backend"]](s, retries, base_delay)


async def stream(system: str, text: str) -> AsyncIterator[str]:
    async for t in (await get_provider()).stream(system, text):
        yield t


async def complete(system: str, text: str, images: Optional[List[bytes]] = None, retries: int = 2,
                   base_delay: float = 2.0) -> str:
    provider = await get_provider(retries, base_delay)
    return "".join([t async for t in provider.stream(system, text, images)])


async def ocr_image(png_bytes: bytes) -> str:
    out = await complete("Eres un sistema OCR preciso.", OCR_PROMPT, [png_bytes], retries=3, base_delay=3)
    return out.strip()
