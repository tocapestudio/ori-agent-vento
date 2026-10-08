"""Phase 5: Cheatsheets API + Conversation ownership (rename/delete)."""
import os
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
PROFILE_ID = "6ac681af4c6b10bd64f5d546"  # Paula


@pytest.fixture(scope="module")
def tok():
    r = requests.post(f"{BASE}/api/auth/access", json={"code": "Orion9944+"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def s(tok):
    sess = requests.Session()
    sess.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return sess


# ---------- Documents helper ----------
def _pick_pdf_doc(s):
    r = s.get(f"{BASE}/api/documents", params={"library": "mine", "profile_id": PROFILE_ID})
    assert r.status_code == 200
    for d in r.json():
        if d.get("status") == "ready" and d.get("file_name", "").lower().endswith(".pdf"):
            return d
    for d in r.json():
        if d.get("status") == "ready":
            return d
    pytest.skip("no ready doc")


# ---------- Cheatsheets ----------
class TestCheatsheets:
    def test_list_common_mine(self, s):
        r1 = s.get(f"{BASE}/api/cheatsheets", params={"library": "common", "profile_id": PROFILE_ID})
        r2 = s.get(f"{BASE}/api/cheatsheets", params={"library": "mine", "profile_id": PROFILE_ID})
        assert r1.status_code == 200 and r2.status_code == 200
        assert isinstance(r1.json(), list) and isinstance(r2.json(), list)

    def test_create_patch_delete_cheatsheet(self, s):
        doc = _pick_pdf_doc(s)
        payload = {
            "doc_ids": [doc["id"]],
            "instructions": "TEST: resumen muy breve del documento",
            "format": "Resumen",
            "title": "TEST_pytest_chuleta",
            "library": "mine",
            "profile_id": PROFILE_ID,
            "tags": ["TEST"],
        }
        r = s.post(f"{BASE}/api/cheatsheets", json=payload)
        assert r.status_code == 200, r.text
        cs = r.json()
        cid = cs["id"]
        assert cs["status"] == "generating"
        assert cs["title"] == "TEST_pytest_chuleta"
        assert cs["doc_ids"] == [doc["id"]]
        assert cs["created_by"] == PROFILE_ID

        # PATCH update tags/title without waiting
        r = s.patch(f"{BASE}/api/cheatsheets/{cid}", json={"title": "TEST_pytest_chuleta_v2", "tags": ["TEST", "x"]})
        assert r.status_code == 200
        assert r.json()["title"] == "TEST_pytest_chuleta_v2"
        assert "x" in r.json()["tags"]

        # GET to verify persistence
        got = s.get(f"{BASE}/api/cheatsheets/{cid}").json()
        assert got["title"] == "TEST_pytest_chuleta_v2"

        # DELETE
        r = s.delete(f"{BASE}/api/cheatsheets/{cid}")
        assert r.status_code == 200
        assert s.get(f"{BASE}/api/cheatsheets/{cid}").status_code == 404

    def test_create_missing_doc_404(self, s):
        r = s.post(f"{BASE}/api/cheatsheets", json={
            "doc_ids": ["000000000000000000000000"],
            "instructions": "x",
            "format": "Resumen",
            "library": "mine",
            "profile_id": PROFILE_ID,
            "tags": [],
        })
        # Either 404 (invalid oid) or validation; both reject
        assert r.status_code in (400, 404, 422)


# ---------- Conversation ownership ----------
class TestConversationOwnership:
    def test_rename_delete_owner_and_403_for_non_owner(self, s):
        # create alt profile
        p = s.post(f"{BASE}/api/profiles", json={"name": "TEST_Alt_phase5"}).json()
        alt_id = p["id"]
        try:
            # trigger conversation creation via /api/chat (non-stream endpoint)
            r = s.post(f"{BASE}/api/chat", json={
                "profile_id": alt_id,
                "scope": "both",
                "web": False,
                "question": "¿Qué es la agudeza visual? Responde en una frase.",
            })
            assert r.status_code == 200, r.text
            cid = r.json().get("conversation_id") or r.json().get("conversation", {}).get("id")
            assert cid, r.json()

            # Paula (non-owner) PATCH → 403
            r = s.patch(f"{BASE}/api/conversations/{cid}", json={"title": "hack", "profile_id": PROFILE_ID})
            assert r.status_code == 403

            # Owner PATCH → 200
            r = s.patch(f"{BASE}/api/conversations/{cid}", json={"title": "TEST_conv_renamed", "profile_id": alt_id})
            assert r.status_code == 200

            # Verify persistence via GET
            got = s.get(f"{BASE}/api/conversations/{cid}").json()
            assert got["conversation"]["title"] == "TEST_conv_renamed"

            # Paula DELETE → 403
            r = s.delete(f"{BASE}/api/conversations/{cid}", params={"profile_id": PROFILE_ID})
            assert r.status_code == 403

            # Owner DELETE → 200
            r = s.delete(f"{BASE}/api/conversations/{cid}", params={"profile_id": alt_id})
            assert r.status_code == 200
        finally:
            s.delete(f"{BASE}/api/profiles/{alt_id}")
