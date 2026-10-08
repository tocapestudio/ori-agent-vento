"""Ori Phase 0 - backend API tests. Uses pre-seeded fixtures in Mongo."""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://visual-therapy-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
FIXTURES = "/app/tests/fixtures"


@pytest.fixture(scope="session")
def common_docs():
    r = requests.get(f"{API}/documents", params={"scope": "common"}, timeout=30)
    assert r.status_code == 200
    return {d["file_name"]: d for d in r.json()}


@pytest.fixture(scope="session")
def profile_docs():
    r = requests.get(f"{API}/documents", params={"scope": "mine", "profile_id": "perfilA"}, timeout=30)
    assert r.status_code == 200
    return {d["file_name"]: d for d in r.json()}


# --- 1. openapi ---
def test_openapi_reachable():
    r = requests.get(f"{API}/openapi.json", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "paths" in data
    assert "/api/documents/upload" in data["paths"]
    assert "/api/chat" in data["paths"]


# --- 2. fixtures reached ready ---
EXPECTED = [
    ("guia_ambliopia.pdf", False),
    ("informe_escaneado.pdf", True),
    ("protocolo_vergencias.docx", False),
    ("normas_acomodacion.xlsx", False),
    ("vision_deportiva.pptx", False),
    ("tabla_estereopsis.png", True),
]


@pytest.mark.parametrize("fname,ocr_expected", EXPECTED)
def test_fixture_ready(common_docs, fname, ocr_expected):
    assert fname in common_docs, f"{fname} missing from common scope"
    d = common_docs[fname]
    assert d["status"] == "ready", f"{fname} status={d['status']} err={d.get('error')}"
    assert d["chunk_count"] > 0
    assert d["ocr_used"] == ocr_expected, f"{fname} ocr_used={d['ocr_used']} expected {ocr_expected}"


def test_ocr_text_contains_expected_facts(common_docs):
    # scanned pdf should contain '11 cm' or similar; png should contain '40 segundos'
    pdf_id = common_docs["informe_escaneado.pdf"]["id"]
    png_id = common_docs["tabla_estereopsis.png"]["id"]
    pdf_text = " ".join(c["text"] for c in requests.get(f"{API}/documents/{pdf_id}").json()["chunks"])
    png_text = " ".join(c["text"] for c in requests.get(f"{API}/documents/{png_id}").json()["chunks"])
    assert "11" in pdf_text and "cm" in pdf_text.lower(), f"PDF OCR missing '11 cm': {pdf_text[:300]}"
    assert "40" in png_text and "segundo" in png_text.lower(), f"PNG OCR missing '40 segundos': {png_text[:300]}"


# --- 3. omega profile doc ---
def test_omega_profile_doc_present(profile_docs):
    assert "caso_omega_perfilA.docx" in profile_docs
    d = profile_docs["caso_omega_perfilA.docx"]
    assert d["status"] == "ready"
    assert d["scope"] == "profile:perfilA"


# --- 4. search endpoint scope filter ---
def test_search_scope_common_excludes_omega():
    r = requests.post(f"{API}/search", json={"query": "paciente Omega prisma", "scope": "common", "k": 8}, timeout=30)
    assert r.status_code == 200
    files = {h["file_name"] for h in r.json()["results"]}
    assert "caso_omega_perfilA.docx" not in files


def test_search_scope_mine_includes_omega():
    r = requests.post(f"{API}/search",
                      json={"query": "paciente Omega prisma", "scope": "mine", "profile_id": "perfilA", "k": 8}, timeout=30)
    assert r.status_code == 200
    files = {h["file_name"] for h in r.json()["results"]}
    assert "caso_omega_perfilA.docx" in files


def test_search_mine_without_profile_errors():
    r = requests.post(f"{API}/search", json={"query": "test", "scope": "mine"}, timeout=15)
    assert r.status_code == 400


# --- 5. chat: answerable with citation ---
def test_chat_orion_alfa_cites_guia():
    r = requests.post(f"{API}/chat", json={
        "question": "¿Cuántas horas de oclusión y cuántas semanas pauta el protocolo Orion-Alfa?",
        "scope": "common", "web_search": False}, timeout=90)
    assert r.status_code == 200
    data = r.json()
    assert data["found_in_docs"] is True, data
    files = {s["file_name"] for s in data["doc_sources"]}
    assert "guia_ambliopia.pdf" in files, f"doc_sources={data['doc_sources']}"
    assert "3" in data["answer"] and "14" in data["answer"]
    assert data["web_sources"] == []


# --- 6. not found behavior ---
def test_chat_not_found_without_web():
    r = requests.post(f"{API}/chat", json={
        "question": "¿Cuál es la prevalencia de miopía en Europa en 2024?",
        "scope": "common", "web_search": False}, timeout=90)
    assert r.status_code == 200
    data = r.json()
    assert data["found_in_docs"] is False
    assert "No lo encuentro en tus documentos" in data["answer"]
    assert data["web_sources"] == []


# --- 7. web search enabled returns labelled sources ---
def test_chat_with_web_search():
    r = requests.post(f"{API}/chat", json={
        "question": "¿Cuál es la prevalencia de miopía en Europa?",
        "scope": "common", "web_search": True}, timeout=120)
    assert r.status_code == 200
    data = r.json()
    assert data["web_search_used"] is True
    assert len(data["web_sources"]) > 0, f"no web sources: {data}"
    assert "Fuente web" in data["answer"]


# --- 8. multi-turn via session_id ---
def test_multi_turn_session():
    r1 = requests.post(f"{API}/chat", json={
        "question": "¿Qué protocolo usa Brock Turquesa a 3 metros?",
        "scope": "common", "web_search": False}, timeout=90)
    assert r1.status_code == 200
    sid = r1.json()["session_id"]
    r2 = requests.post(f"{API}/chat", json={
        "question": "¿Cuántas cuentas se usan en ese protocolo?",
        "scope": "common", "web_search": False, "session_id": sid}, timeout=90)
    assert r2.status_code == 200
    assert r2.json()["session_id"] == sid
    hist = requests.get(f"{API}/sessions/{sid}/messages", timeout=15).json()
    assert len(hist) == 4  # 2 user + 2 assistant
    assert hist[0]["role"] == "user"


# --- 9. PATCH notes become retrievable ---
def test_patch_notes_retrievable(common_docs):
    doc_id = common_docs["tabla_estereopsis.png"]["id"]
    unique = f"AlfaZeta{uuid.uuid4().hex[:6]}"
    note = f"Clave interna del test: {unique} para estereopsis infantil."
    r = requests.patch(f"{API}/documents/{doc_id}", json={"notes": note, "tags": ["test", "nota"]}, timeout=30)
    assert r.status_code == 200
    assert r.json()["notes"] == note
    time.sleep(1)
    # Search should find the note
    s = requests.post(f"{API}/search", json={"query": unique, "scope": "common", "k": 5}, timeout=30).json()
    files_kinds = [(h["file_name"], h.get("kind")) for h in s["results"]]
    assert any(f == "tabla_estereopsis.png" and k == "note" for f, k in files_kinds), files_kinds


# --- 10. upload + delete lifecycle ---
def test_upload_and_delete_lifecycle():
    with open(f"{FIXTURES}/protocolo_vergencias.docx", "rb") as fh:
        files = {"files": ("TEST_delete_me.docx", fh,
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        data = {"scope": "common", "tags": "TEST_", "notes": ""}
        r = requests.post(f"{API}/documents/upload", files=files, data=data, timeout=60)
    assert r.status_code == 200
    doc = r.json()[0]
    did = doc["id"]
    # Wait for ready
    for _ in range(30):
        time.sleep(2)
        g = requests.get(f"{API}/documents/{did}", timeout=15).json()
        if g["document"]["status"] in ("ready", "error"):
            break
    assert g["document"]["status"] == "ready", g
    assert g["document"]["chunk_count"] > 0
    # Delete
    d = requests.delete(f"{API}/documents/{did}", timeout=15)
    assert d.status_code == 200
    # Verify chunks removed via search returning no results for this filename-specific query
    g2 = requests.get(f"{API}/documents/{did}", timeout=15)
    assert g2.status_code == 404


# --- 11. invalid upload type ---
def test_upload_rejects_unsupported():
    files = {"files": ("bad.txt", b"hello", "text/plain")}
    r = requests.post(f"{API}/documents/upload", files=files, data={"scope": "common"}, timeout=15)
    assert r.status_code == 400


# --- 12. invalid scope / profile missing ---
def test_upload_profile_without_id():
    with open(f"{FIXTURES}/protocolo_vergencias.docx", "rb") as fh:
        files = {"files": ("x.docx", fh,
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        r = requests.post(f"{API}/documents/upload", files=files, data={"scope": "profile"}, timeout=15)
    assert r.status_code == 400


# --- 13. invalid doc id ---
def test_get_invalid_doc_id():
    r = requests.get(f"{API}/documents/not-an-oid", timeout=10)
    assert r.status_code == 404
