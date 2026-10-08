"""Backend regression suite for Ori Phase 1 (access code, profiles, documents, chat, settings)."""
import io
import json
import os
import time

import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else None
if not BASE:
    # fallback: read frontend .env
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
            break
API = f"{BASE}/api"
CODE = "Orion9944+"
PAULA_ID = "6ac681af4c6b10bd64f5d546"
FIX = "/app/tests/fixtures"


# ---------------- auth ----------------
@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/access", json={"code": CODE}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- auth: access ----------------
def test_access_wrong_code_401():
    r = requests.post(f"{API}/auth/access", json={"code": "wrong-code-xyz"}, timeout=30)
    assert r.status_code == 401
    assert "incorrecto" in r.json()["detail"].lower()


def test_access_correct_returns_token():
    r = requests.post(f"{API}/auth/access", json={"code": CODE}, timeout=30)
    assert r.status_code == 200
    tok = r.json()["token"]
    assert isinstance(tok, str) and len(tok) > 20


def test_protected_without_token_401():
    assert requests.get(f"{API}/profiles", timeout=15).status_code == 401
    assert requests.get(f"{API}/settings", timeout=15).status_code == 401
    assert requests.get(f"{API}/documents?library=common", timeout=15).status_code == 401


def test_auth_check(H):
    r = requests.get(f"{API}/auth/check", headers=H, timeout=15)
    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ---------------- profiles ----------------
def test_list_profiles_contains_paula(H):
    r = requests.get(f"{API}/profiles", headers=H, timeout=15)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert PAULA_ID in ids, f"Paula missing: {ids}"


@pytest.fixture
def temp_profile(H):
    r = requests.post(f"{API}/profiles", headers=H, json={"name": "TEST_Profile", "color": "#123456"}, timeout=15)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{API}/profiles/{pid}", headers=H, timeout=15)


def test_profile_crud(H, temp_profile):
    # patch
    r = requests.patch(f"{API}/profiles/{temp_profile}", headers=H,
                       json={"name": "TEST_Updated", "color": "#654321"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Updated"
    # verify in list
    r = requests.get(f"{API}/profiles", headers=H, timeout=15)
    assert any(p["id"] == temp_profile and p["name"] == "TEST_Updated" for p in r.json())


def test_profile_delete_removes_data(H):
    r = requests.post(f"{API}/profiles", headers=H, json={"name": "TEST_ToDelete", "color": "#aabbcc"}, timeout=15)
    pid = r.json()["id"]
    requests.delete(f"{API}/profiles/{pid}", headers=H, timeout=15)
    # confirm 404 on patch
    r2 = requests.patch(f"{API}/profiles/{pid}", headers=H, json={"name": "x", "color": "#000000"}, timeout=15)
    assert r2.status_code == 404


# ---------------- documents ----------------
def test_list_common_has_fixtures(H):
    r = requests.get(f"{API}/documents?library=common", headers=H, timeout=20)
    assert r.status_code == 200
    names = [d["file_name"] for d in r.json()]
    for exp in ["guia_ambliopia.pdf", "vision_deportiva.pptx", "informe_escaneado.pdf"]:
        assert exp in names, f"missing {exp} in {names}"


def test_list_paula_mine_has_omega(H):
    r = requests.get(f"{API}/documents?library=mine&profile_id={PAULA_ID}", headers=H, timeout=20)
    assert r.status_code == 200
    names = [d["file_name"] for d in r.json()]
    assert "caso_omega_perfilA.docx" in names


def test_mine_requires_profile_id(H):
    r = requests.get(f"{API}/documents?library=mine", headers=H, timeout=15)
    assert r.status_code == 400


def test_document_get_and_preview(H):
    docs = requests.get(f"{API}/documents?library=common", headers=H, timeout=20).json()
    doc = next(d for d in docs if d["file_name"] == "guia_ambliopia.pdf")
    r = requests.get(f"{API}/documents/{doc['id']}", headers=H, timeout=20)
    assert r.status_code == 200
    body = r.json()
    assert body["document"]["file_name"] == "guia_ambliopia.pdf"
    assert isinstance(body["preview"], list) and len(body["preview"]) > 0
    assert "ref" in body["preview"][0] and "text" in body["preview"][0]


def test_document_file_inline_and_download(H):
    docs = requests.get(f"{API}/documents?library=common", headers=H, timeout=20).json()
    doc = next(d for d in docs if d["file_name"] == "guia_ambliopia.pdf")
    # Using token query param (file links)
    tok = H["Authorization"].split()[1]
    r = requests.get(f"{API}/documents/{doc['id']}/file?token={tok}", timeout=20)
    assert r.status_code == 200
    assert "attachment" not in r.headers.get("content-disposition", "").lower()
    assert r.content[:4] == b"%PDF"
    r2 = requests.get(f"{API}/documents/{doc['id']}/file?download=true&token={tok}", timeout=20)
    assert "attachment" in r2.headers.get("content-disposition", "").lower()


def test_upload_patch_delete_lifecycle(H, temp_profile):
    with open(f"{FIX}/protocolo_vergencias.docx", "rb") as f:
        files = {"files": ("TEST_delete_me.docx", f.read(),
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    r = requests.post(f"{API}/documents/upload", headers=H, files=files,
                      data={"library": "mine", "profile_id": temp_profile, "tags": "TEST,regression",
                            "notes": "TEST notes"}, timeout=60)
    assert r.status_code == 200, r.text
    doc_id = r.json()[0]["id"]
    # wait for ready
    deadline = time.time() + 60
    status = "processing"
    while time.time() < deadline:
        d = requests.get(f"{API}/documents/{doc_id}", headers=H, timeout=15).json()["document"]
        status = d["status"]
        if status in ("ready", "error"):
            break
        time.sleep(1.5)
    assert status == "ready", f"status={status}"
    # patch tags/notes
    rp = requests.patch(f"{API}/documents/{doc_id}", headers=H,
                        json={"tags": ["TEST", "updated"], "notes": "TEST updated notes"}, timeout=15)
    assert rp.status_code == 200
    assert "updated" in rp.json()["tags"]
    # reprocess
    rr = requests.post(f"{API}/documents/{doc_id}/reprocess", headers=H, timeout=20)
    assert rr.status_code == 200
    # delete
    rd = requests.delete(f"{API}/documents/{doc_id}", headers=H, timeout=15)
    assert rd.status_code == 200
    # confirm gone
    assert requests.get(f"{API}/documents/{doc_id}", headers=H, timeout=15).status_code == 404


def test_upload_unsupported_type(H):
    files = {"files": ("evil.exe", b"MZ\x00\x00", "application/octet-stream")}
    r = requests.post(f"{API}/documents/upload", headers=H, files=files,
                      data={"library": "common"}, timeout=20)
    assert r.status_code == 400


# ---------------- chat ----------------
def test_chat_orion_alfa_grounded(H):
    body = {"question": "¿Qué horas de oclusión indica el protocolo Orion-Alfa?",
            "profile_id": PAULA_ID, "scope": "common", "web_search": False}
    r = requests.post(f"{API}/chat", headers=H, json=body, timeout=120)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["found_in_docs"] is True
    ans = d["answer"].lower()
    assert "guia_ambliopia" in ans or any(s["file_name"] == "guia_ambliopia.pdf" for s in d["doc_sources"])
    assert d["web_sources"] == []
    return d["conversation_id"]


def test_chat_not_found_no_web(H):
    body = {"question": "¿Cuál es la temperatura óptima del quirófano según el manual Lumen-77?",
            "profile_id": PAULA_ID, "scope": "common", "web_search": False}
    r = requests.post(f"{API}/chat", headers=H, json=body, timeout=120)
    assert r.status_code == 200
    d = r.json()
    assert d["found_in_docs"] is False
    assert d["doc_sources"] == []
    assert d["web_sources"] == []
    assert "no lo encuentro" in d["answer"].lower()


def test_chat_scope_mine_vs_common_for_omega(H):
    # common -> not found
    body = {"question": "¿Qué prisma lleva el caso Omega?", "profile_id": PAULA_ID,
            "scope": "common", "web_search": False}
    r = requests.post(f"{API}/chat", headers=H, json=body, timeout=120)
    d = r.json()
    assert d["found_in_docs"] is False, f"should NOT find Omega in common: {d['answer']}"
    # mine -> found
    body["scope"] = "mine"
    r2 = requests.post(f"{API}/chat", headers=H, json=body, timeout=120)
    d2 = r2.json()
    assert d2["found_in_docs"] is True
    assert "omega" in d2["answer"].lower() or any("omega" in s["file_name"].lower() for s in d2["doc_sources"])


def test_conversations_persist_and_list(H):
    # create a tiny conversation
    body = {"question": "Resume brevemente el protocolo Orion-Alfa.", "profile_id": PAULA_ID,
            "scope": "common", "web_search": False}
    r = requests.post(f"{API}/chat", headers=H, json=body, timeout=120)
    assert r.status_code == 200
    conv_id = r.json()["conversation_id"]
    # list
    rl = requests.get(f"{API}/conversations?profile_id={PAULA_ID}", headers=H, timeout=15)
    assert rl.status_code == 200
    assert any(c["id"] == conv_id for c in rl.json())
    # get messages
    rg = requests.get(f"{API}/conversations/{conv_id}", headers=H, timeout=15)
    assert rg.status_code == 200
    msgs = rg.json()["messages"]
    assert len(msgs) >= 2 and msgs[0]["role"] == "user" and msgs[-1]["role"] == "assistant"
    # patch title
    rp = requests.patch(f"{API}/conversations/{conv_id}", headers=H,
                        json={"title": "TEST título renombrado"}, timeout=15)
    assert rp.status_code == 200
    # writing to this conv from another profile_id -> 403
    bad = {"question": "hola", "profile_id": "000000000000000000000000",
           "scope": "common", "web_search": False, "conversation_id": conv_id}
    rb = requests.post(f"{API}/chat", headers=H, json=bad, timeout=30)
    assert rb.status_code == 403
    # delete
    rd = requests.delete(f"{API}/conversations/{conv_id}", headers=H, timeout=15)
    assert rd.status_code == 200


def test_chat_stream_sse(H):
    body = {"question": "Di 'Hola' en una palabra.", "profile_id": PAULA_ID,
            "scope": "common", "web_search": False}
    r = requests.post(f"{API}/chat/stream", headers=H, json=body, timeout=120, stream=True)
    assert r.status_code == 200
    types = []
    conv_id = None
    for line in r.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        ev = json.loads(line[5:].strip())
        types.append(ev["type"])
        if ev["type"] == "done":
            conv_id = ev["conversation_id"]
            break
    assert "meta" in types and "done" in types
    assert "delta" in types or "error" in types
    if conv_id:
        requests.delete(f"{API}/conversations/{conv_id}", headers=H, timeout=15)


# ---------------- settings ----------------
def test_settings_mask_key(H):
    r = requests.get(f"{API}/settings", headers=H, timeout=15)
    assert r.status_code == 200
    s = r.json()
    assert s["gemini_api_key_set"] is True
    # Must never leak the key
    assert "AQ.Ab8RN6" not in json.dumps(s)
    assert s.get("llm_backend") in ("gemini", "ollama")


def test_settings_test_llm(H):
    r = requests.post(f"{API}/settings/test-llm", headers=H, timeout=120)
    assert r.status_code == 200
    d = r.json()
    assert "ok" in d and "backend" in d and "message" in d


def test_settings_switch_ollama_and_back(H):
    try:
        r = requests.put(f"{API}/settings", headers=H, json={"llm_backend": "ollama"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["llm_backend"] == "ollama"
        # test-llm should gracefully fail
        rt = requests.post(f"{API}/settings/test-llm", headers=H, timeout=30)
        assert rt.status_code == 200
        assert rt.json()["ok"] is False
    finally:
        rb = requests.put(f"{API}/settings", headers=H, json={"llm_backend": "gemini"}, timeout=15)
        assert rb.status_code == 200
        assert rb.json()["llm_backend"] == "gemini"


def test_settings_change_access_code_and_revert(H):
    tmp = "TempCode_Testing#9"
    # change -> new token, old invalidated
    r = requests.post(f"{API}/settings/access-code", headers=H,
                      json={"current_code": CODE, "new_code": tmp}, timeout=15)
    assert r.status_code == 200
    new_tok = r.json()["token"]
    # old token now invalid
    old_check = requests.get(f"{API}/auth/check", headers=H, timeout=15)
    assert old_check.status_code == 401
    # new token works
    nh = {"Authorization": f"Bearer {new_tok}"}
    assert requests.get(f"{API}/auth/check", headers=nh, timeout=15).status_code == 200
    # Old code should no longer authenticate
    r_old = requests.post(f"{API}/auth/access", json={"code": CODE}, timeout=15)
    assert r_old.status_code == 401
    # Revert BACK to Orion9944+
    rr = requests.post(f"{API}/settings/access-code", headers=nh,
                       json={"current_code": tmp, "new_code": CODE}, timeout=15)
    assert rr.status_code == 200
    # The session-level H token is now stale. Caller must refresh. Verify fresh login works.
    r_fresh = requests.post(f"{API}/auth/access", json={"code": CODE}, timeout=15)
    assert r_fresh.status_code == 200
