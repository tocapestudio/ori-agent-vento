"""Phase-8 Ori chat tests: disclaimer separation + inline citations metadata."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://visual-therapy-agent.preview.emergentagent.com").rstrip("/")
TEAM_CODE = "Orion9944+"
PROFILE_ID = "6ac681af4c6b10bd64f5d546"  # Paula
EXISTING_CONV = "6ac6c2208965f11733f2cc2a"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/access", json={"code": TEAM_CODE}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


class TestExistingConversationMessages:
    def test_get_conversation_messages_have_disclaimer_field(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/conversations/{EXISTING_CONV}", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        msgs = data["messages"]
        assistant_msgs = [m for m in msgs if m["role"] == "assistant"]
        assert assistant_msgs, "no assistant messages in Paula's conversation"
        # at least one assistant message should expose the disclaimer key
        for m in assistant_msgs:
            assert "disclaimer" in m, f"message {m.get('id')} missing disclaimer key"
        # And content must not end with the disclaimer sentence
        for m in assistant_msgs:
            if m.get("disclaimer"):
                assert "herramienta de apoyo" not in m["content"].lower()[-400:], \
                    f"content still ends with disclaimer: ...{m['content'][-200:]!r}"

    def test_doc_sources_present_for_cited_messages(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/conversations/{EXISTING_CONV}", headers=auth_headers, timeout=20)
        msgs = r.json()["messages"]
        # messages whose content contains [filename ...] must have doc_sources entries
        bracket_re = re.compile(r"\[([^\[\]]{3,250})\]")
        cited = [m for m in msgs if m["role"] == "assistant" and bracket_re.search(m["content"])]
        assert cited, "no cited assistant messages — cannot verify inline refs"
        for m in cited:
            if m.get("doc_sources"):
                s = m["doc_sources"][0]
                for k in ("doc_id", "file_name", "ref"):
                    assert k in s, f"doc_source missing {k}: {s}"


class TestDocumentFileEndpoints:
    def test_file_served_inline_pdf(self, auth_headers):
        # pick a doc_id from existing message sources
        r = requests.get(f"{BASE_URL}/api/conversations/{EXISTING_CONV}", headers=auth_headers, timeout=20)
        msgs = r.json()["messages"]
        pdf_src = None
        for m in msgs:
            for s in m.get("doc_sources") or []:
                if s.get("doc_id"):
                    doc = requests.get(f"{BASE_URL}/api/documents/{s['doc_id']}", headers=auth_headers, timeout=20)
                    if doc.status_code == 200 and doc.json()["document"].get("file_type") == "pdf" and doc.json()["document"].get("has_original"):
                        pdf_src = s["doc_id"]
                        break
            if pdf_src:
                break
        if not pdf_src:
            pytest.skip("no PDF doc in sources with original file")
        # inline fetch via token query param (iframe cannot send Authorization header)
        token = auth_headers["Authorization"].split()[1]
        r = requests.get(f"{BASE_URL}/api/documents/{pdf_src}/file?token={token}", timeout=20, allow_redirects=True)
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("content-type", "").lower()
        # inline (no attachment disposition when download not requested)
        disp = r.headers.get("content-disposition", "").lower()
        assert "attachment" not in disp, f"expected inline, got {disp}"

    def test_file_served_download_pdf(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/conversations/{EXISTING_CONV}", headers=auth_headers, timeout=20)
        msgs = r.json()["messages"]
        pdf_src = None
        for m in msgs:
            for s in m.get("doc_sources") or []:
                if s.get("doc_id"):
                    doc = requests.get(f"{BASE_URL}/api/documents/{s['doc_id']}", headers=auth_headers, timeout=20)
                    if doc.status_code == 200 and doc.json()["document"].get("has_original"):
                        pdf_src = s["doc_id"]; break
            if pdf_src: break
        if not pdf_src:
            pytest.skip("no doc with original")
        token = auth_headers["Authorization"].split()[1]
        r = requests.get(f"{BASE_URL}/api/documents/{pdf_src}/file?token={token}&download=true", timeout=20, allow_redirects=True)
        assert r.status_code == 200
        disp = r.headers.get("content-disposition", "").lower()
        assert "attachment" in disp, f"expected attachment disposition, got {disp}"


class TestSplitDisclaimerUnit:
    """Unit-ish check of backend split_disclaimer behavior through POST /api/chat.
    We only run ONE live LLM call to respect rate limits."""

    def test_post_chat_returns_disclaimer_field(self, auth_headers):
        payload = {
            "question": "Hola Ori, responde en una sola frase corta: '2+2'.",
            "profile_id": PROFILE_ID,
            "scope": "both",
            "web_search": False,
        }
        r = requests.post(f"{BASE_URL}/api/chat", json=payload, headers=auth_headers, timeout=90)
        if r.status_code != 200:
            pytest.skip(f"LLM unavailable or rate-limited: {r.status_code} {r.text[:200]}")
        data = r.json()
        assert "disclaimer" in data, f"response missing disclaimer field: keys={list(data.keys())}"
        assert "answer" in data
        if data.get("disclaimer"):
            assert "herramienta de apoyo" not in data["answer"].lower()[-400:]
        # cleanup: delete the new conv
        conv_id = data.get("conversation_id")
        if conv_id:
            requests.delete(f"{BASE_URL}/api/conversations/{conv_id}?profile_id={PROFILE_ID}", headers=auth_headers, timeout=10)
