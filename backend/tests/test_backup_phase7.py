"""Phase 7 backup tests: export zip structure, import error handling, auth, secret stripping."""
import io
import json
import os
import zipfile

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://visual-therapy-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
CODE = "Orion9944+"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(f"{API}/auth/access", json={"code": CODE})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def export_zip(auth_headers):
    r = requests.get(f"{API}/backup/export", headers=auth_headers)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    return r.content


def test_export_requires_auth():
    r = requests.get(f"{API}/backup/export")
    assert r.status_code == 401


def test_import_requires_auth():
    r = requests.post(f"{API}/backup/import", files={"file": ("x.zip", b"xxx")}, data={"mode": "merge"})
    assert r.status_code == 401


def test_export_contains_manifest_and_collections(export_zip):
    z = zipfile.ZipFile(io.BytesIO(export_zip))
    names = set(z.namelist())
    assert "manifest.json" in names
    manifest = json.loads(z.read("manifest.json"))
    assert manifest["app"] == "ori"
    assert manifest["version"] == 1
    assert "counts" in manifest and isinstance(manifest["counts"], dict)
    for col in ["profiles", "folders", "documents", "chunks", "conversations", "messages",
                "cheatsheets", "templates", "favorites", "orders", "settings"]:
        assert f"collections/{col}.jsonl" in names, f"missing {col}.jsonl"
        assert col in manifest["counts"]


def test_export_strips_gemini_api_key(export_zip):
    z = zipfile.ZipFile(io.BytesIO(export_zip))
    raw = z.read("collections/settings.jsonl").decode()
    assert "gemini_api_key" not in raw, "Export leaked gemini_api_key"


def test_import_invalid_mode(auth_headers, export_zip):
    r = requests.post(f"{API}/backup/import", headers=auth_headers,
                      files={"file": ("x.zip", export_zip)}, data={"mode": "bogus"})
    assert r.status_code == 400
    assert "Modo" in r.json()["detail"] or "válido" in r.json()["detail"]


def test_import_invalid_zip(auth_headers):
    r = requests.post(f"{API}/backup/import", headers=auth_headers,
                      files={"file": ("x.zip", b"not a real zip")}, data={"mode": "merge"})
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert "zip" in detail.lower() or "válido" in detail


def test_import_non_ori_zip(auth_headers):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("hello.txt", "world")
    r = requests.post(f"{API}/backup/import", headers=auth_headers,
                      files={"file": ("fake.zip", buf.getvalue())}, data={"mode": "merge"})
    assert r.status_code == 400
    assert "Ori" in r.json()["detail"] or "copia" in r.json()["detail"]


def test_import_merge_preserves_gemini_key_and_search_works(auth_headers, export_zip):
    r = requests.post(f"{API}/backup/import", headers=auth_headers,
                      files={"file": ("ori.zip", export_zip)}, data={"mode": "merge"})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "merge"
    assert "restored" in body and "files" in body
    # After import, search should still work (vector index rebuilt)
    s = requests.post(f"{API}/search", headers=auth_headers,
                      json={"query": "acomodación", "scope": "common"})
    assert s.status_code == 200
