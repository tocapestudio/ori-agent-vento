"""Backend tests for Ori Phase-4 features: templates, favorites.
Chat template flow (streaming) is covered by UI test; here we do REST only.
"""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PAULA = "6ac681af4c6b10bd64f5d546"
ACCESS = "Orion9944+"


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{BASE}/auth/access", json={"code": ACCESS}, timeout=15)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def alt_profile(auth):
    r = auth.post(f"{BASE}/profiles", json={"name": "TEST_Alt", "color": "#223344"})
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]
    yield pid
    auth.delete(f"{BASE}/profiles/{pid}")


# ---------- Templates ----------
class TestTemplates:
    def test_seeded_common_templates(self, auth):
        r = auth.get(f"{BASE}/templates?profile_id={PAULA}")
        assert r.status_code == 200
        data = r.json()
        common = [t for t in data if t["scope"] == "common"]
        assert len(common) >= 2
        names = {t["name"] for t in common}
        assert any("Informe" in n for n in names)

    def test_create_patch_delete_personal(self, auth):
        body = {"name": "TEST_tpl_paula", "category": "Otro",
                "body": "# Hola {{nombre}}", "visibility": "mine", "profile_id": PAULA}
        r = auth.post(f"{BASE}/templates", json=body)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        assert r.json()["scope"] == f"profile:{PAULA}"

        # patch
        r = auth.patch(f"{BASE}/templates/{tid}", json={"profile_id": PAULA, "name": "TEST_tpl_paula2"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_tpl_paula2"

        # verify via GET
        r = auth.get(f"{BASE}/templates?profile_id={PAULA}")
        assert any(t["id"] == tid and t["name"] == "TEST_tpl_paula2" for t in r.json())

        # delete
        r = auth.delete(f"{BASE}/templates/{tid}?profile_id={PAULA}")
        assert r.status_code == 200

    def test_personal_template_invisible_to_other_profile(self, auth, alt_profile):
        body = {"name": "TEST_tpl_private", "category": "Otro", "body": "x", "visibility": "mine", "profile_id": PAULA}
        tid = auth.post(f"{BASE}/templates", json=body).json()["id"]

        # alt profile cannot see it
        lst = auth.get(f"{BASE}/templates?profile_id={alt_profile}").json()
        assert all(t["id"] != tid for t in lst)

        # alt profile cannot patch nor delete -> 404
        assert auth.patch(f"{BASE}/templates/{tid}", json={"profile_id": alt_profile, "name": "x"}).status_code == 404
        assert auth.delete(f"{BASE}/templates/{tid}?profile_id={alt_profile}").status_code == 404

        auth.delete(f"{BASE}/templates/{tid}?profile_id={PAULA}")


# ---------- Favorites ----------
@pytest.fixture(scope="module")
def conv_and_msg(auth):
    # Try to use the pre-seeded conversation; if it has messages use the last assistant one.
    convs = auth.get(f"{BASE}/conversations?profile_id={PAULA}").json()
    assert convs
    cid = convs[0]["id"]
    data = auth.get(f"{BASE}/conversations/{cid}").json()
    msgs = data["messages"]
    assistant_ids = [m["id"] for m in msgs if m["role"] == "assistant"]
    return cid, assistant_ids[-1] if assistant_ids else None


class TestFavorites:
    def test_favorite_conversation_and_remove_perm(self, auth, alt_profile, conv_and_msg):
        cid, _ = conv_and_msg
        r = auth.post(f"{BASE}/favorites", json={"conversation_id": cid, "profile_id": PAULA})
        assert r.status_code == 200, r.text
        fid = r.json()["id"]
        assert r.json()["saved_by"] == PAULA

        # Idempotent: posting again returns same id
        r2 = auth.post(f"{BASE}/favorites", json={"conversation_id": cid, "profile_id": PAULA})
        assert r2.json()["id"] == fid

        # alt profile can see it (list is global)
        lst = auth.get(f"{BASE}/favorites").json()
        assert any(f["id"] == fid for f in lst)

        # alt profile cannot remove -> 403
        r3 = auth.delete(f"{BASE}/favorites/{fid}?profile_id={alt_profile}")
        assert r3.status_code == 403, r3.text

        # Owner can remove
        r4 = auth.delete(f"{BASE}/favorites/{fid}?profile_id={PAULA}")
        assert r4.status_code == 200

        lst = auth.get(f"{BASE}/favorites").json()
        assert all(f["id"] != fid for f in lst)

    def test_favorite_message_with_snippet(self, auth, conv_and_msg):
        cid, mid = conv_and_msg
        if not mid:
            pytest.skip("No assistant message to favorite")
        r = auth.post(f"{BASE}/favorites",
                      json={"conversation_id": cid, "message_id": mid, "profile_id": PAULA})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["kind"] == "message"
        assert data["message_id"] == mid
        assert len(data["snippet"]) > 0

        # Search filter by saved_by_name
        r2 = auth.get(f"{BASE}/favorites?q=Paula")
        assert r2.status_code == 200
        assert any(f["id"] == data["id"] for f in r2.json())

        auth.delete(f"{BASE}/favorites/{data['id']}?profile_id={PAULA}")

    def test_favorite_bad_message_404(self, auth, conv_and_msg):
        cid, _ = conv_and_msg
        r = auth.post(f"{BASE}/favorites",
                      json={"conversation_id": cid, "message_id": "000000000000000000000000", "profile_id": PAULA})
        assert r.status_code == 404
