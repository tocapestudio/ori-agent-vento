import logging
import re

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS

logger = logging.getLogger(__name__)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}


def _fetch(url: str, limit: int = 2500) -> str:
    try:
        r = requests.get(url, headers=UA, timeout=8)
        soup = BeautifulSoup(r.text, "lxml")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
            tag.decompose()
        return re.sub(r"\s+", " ", soup.get_text(" "))[:limit]
    except Exception as e:
        logger.warning("fetch failed %s: %s", url, e)
        return ""


def web_search(query: str, max_results: int = 5, fetch_top: int = 3):
    try:
        results = DDGS().text(query, region="es-es", max_results=max_results) or []
    except Exception as e:
        logger.warning("ddgs failed: %s", e)
        return []
    out = []
    for i, r in enumerate(results):
        url = r.get("href") or r.get("url")
        if not url:
            continue
        snippet = r.get("body", "")
        content = _fetch(url) if i < fetch_top else ""
        out.append({"title": r.get("title", url), "url": url, "snippet": snippet, "content": content or snippet})
    return out
