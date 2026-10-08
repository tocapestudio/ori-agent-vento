"""LLM provider layer: gemini, claude, openai-compatible (OpenRouter etc.) or ollama (local). Selected via Settings/env."""
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


class _RetryableHTTP(Exception):
    def __init__(self, code: int):
        super().__init__(code)
        self.code = code


async def _sse_lines(resp):
    """Yields the JSON payloads of a server-sent-events response."""
    async for line in resp.aiter_lines():
        if line.startswith("data:"):
            data = line[5:].strip()
            if data and data != "[DONE]":
                yield json.loads(data)


class _HTTPStreamProvider:
    """Common retry logic for providers reached by plain HTTPS streaming (Claude, OpenAI-compatible)."""
    name = "IA"
    rate_msg = "El proveedor de IA ha alcanzado su límite por un momento. Inténtalo en unos segundos."

    def __init__(self, retries: int, base_delay: float):
        self.retries, self.base_delay = max(1, retries), base_delay

    async def _once(self, system, text, images):  # pragma: no cover - implemented by subclasses
        raise NotImplementedError
        yield ""

    async def _check(self, r):
        if r.status_code < 400:
            return
        body = (await r.aread())[:400].decode(errors="replace")
        logger.warning("%s HTTP %s: %s", self.name, r.status_code, body)
        if r.status_code in RETRY_CODES or r.status_code == 529:
            raise _RetryableHTTP(r.status_code)
        if r.status_code in (401, 403):
            raise LLMError(f"La clave de {self.name} no es válida o no tiene permiso. Revísala en Ajustes.", 400)
        raise LLMError(f"Error del proveedor {self.name} ({r.status_code}): {body[:200]}", 502)

    async def stream(self, system, text, images=None) -> AsyncIterator[str]:
        last = None
        for attempt in range(self.retries):
            started = False
            try:
                async for t in self._once(system, text, images):
                    started = True
                    yield t
                return
            except _RetryableHTTP as e:
                last = e.code
            except (httpx.HTTPError, asyncio.TimeoutError) as e:
                logger.warning("%s network error: %r", self.name, e)
                last = 503
            if started:
                raise LLMError(self.rate_msg if last == 429 else BUSY_MSG, 429 if last == 429 else 503)
            await asyncio.sleep(self.base_delay * (2 ** attempt))
        raise LLMError(self.rate_msg, 429) if last == 429 else LLMError(BUSY_MSG, 503)


class ClaudeProvider(_HTTPStreamProvider):
    """Anthropic Claude via the Messages API (needs an API key from console.anthropic.com)."""
    name = "Claude"

    def __init__(self, s: dict, retries: int, base_delay: float):
        super().__init__(retries, base_delay)
        if not s.get("anthropic_api_key"):
            raise LLMError("Falta la clave de API de Claude. Añádela en Ajustes.", 400)
        self.key, self.model = s["anthropic_api_key"], (s.get("anthropic_model") or "claude-sonnet-5-5")

    async def _once(self, system, text, images):
        content = [{"type": "image", "source": {"type": "base64", "media_type": "image/png",
                                                "data": base64.b64encode(p).decode()}} for p in images or []]
        content.append({"type": "text", "text": text})
        payload = {"model": self.model, "max_tokens": 8192, "system": system, "stream": True,
                   "messages": [{"role": "user", "content": content}]}
        headers = {"x-api-key": self.key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=20)) as c:
            async with c.stream("POST", "https://api.anthropic.com/v1/messages", json=payload, headers=headers) as r:
                await self._check(r)
                async for ev in _sse_lines(r):
                    if ev.get("type") == "content_block_delta" and ev.get("delta", {}).get("type") == "text_delta":
                        yield ev["delta"]["text"]
                    elif ev.get("type") == "error":
                        err = ev.get("error", {})
                        logger.warning("Claude stream error: %s", err)
                        if err.get("type") in ("overloaded_error", "rate_limit_error", "api_error"):
                            raise _RetryableHTTP(429 if err.get("type") == "rate_limit_error" else 503)
                        raise LLMError(f"Error de Claude: {err.get('message', err)}", 502)


class OpenAICompatProvider(_HTTPStreamProvider):
    """Any OpenAI-compatible endpoint: OpenRouter (many models, one key), OpenAI, Mistral, etc."""
    name = "IA externa"

    def __init__(self, s: dict, retries: int, base_delay: float):
        super().__init__(retries, base_delay)
        if not s.get("openai_api_key") or not s.get("openai_model"):
            raise LLMError("Falta la clave o el modelo del proveedor compatible con OpenAI. Complétalos en Ajustes.", 400)
        self.url = (s.get("openai_base_url") or "https://openrouter.ai/api/v1").rstrip("/")
        self.key, self.model = s["openai_api_key"], s["openai_model"]

    async def _once(self, system, text, images):
        if images:
            user = [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(p).decode()}}
                    for p in images] + [{"type": "text", "text": text}]
        else:
            user = text
        payload = {"model": self.model, "stream": True,
                   "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        headers = {"Authorization": f"Bearer {self.key}", "X-Title": "Ori"}
        async with httpx.AsyncClient(timeout=httpx.Timeout(180, connect=20)) as c:
            async with c.stream("POST", f"{self.url}/chat/completions", json=payload, headers=headers) as r:
                await self._check(r)
                async for ev in _sse_lines(r):
                    if ev.get("error"):
                        raise LLMError(f"Error del proveedor: {ev['error'].get('message', ev['error'])}", 502)
                    for ch in ev.get("choices") or []:
                        t = (ch.get("delta") or {}).get("content")
                        if t:
                            yield t


PROVIDERS = {"gemini": GeminiProvider, "ollama": OllamaProvider, "claude": ClaudeProvider, "openai": OpenAICompatProvider}


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
