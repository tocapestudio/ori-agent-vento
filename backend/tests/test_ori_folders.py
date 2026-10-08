"""Backend tests for the NEW Folders feature + web_sources extraction (iteration 3)."""
import io
import os
import time

import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL"):
            BASE = line.split("=", 1)[1].strip().strip('"')
            break
BASE = BASE.rstrip("/")
API = f"{BASE}/api"
CODE = "Orion9944+"
PAULA_ID = "6ac681af4c6b10bd64f5d546"


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/access", json={"code": CODE}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def temp_profile(H):
    r = requests.post(f"{API}/profiles", headers=H, json={"name": "TEST_FoldersP", "color": "#aa33cc"}, timeout=15)
    assert r.status_code == 200
    pid = r.json()["id"]
    yield pid
    requests.delete(f"{API}/profiles/{pid}", headers=H, timeout=15)


# ---------- folder CRUD ----------
def test_folders_crud_tree_common(H):
    created = []
    try:
        # root folder
        r = requests.post(f"{API}/folders", headers=H,
                          json={"name": "TEST_Root", "library": "common"}, timeout=15)
        assert r.status_code == 200, r.text
        root = r.json()
        created.append(root["id"])
        assert root["parent_id"] is None and root["scope"] == "common"

        # child
        r = requests.post(f"{API}/folders", headers=H,
                          json={"name": "TEST_Child", "library": "common", "parent_id": root["id"]}, timeout=15)
        assert r.status_code == 200
        child = r.json()
        created.append(child["id"])
        assert child["parent_id"] == root["id"]

        # list contains both
        r = requests.get(f"{API}/folders", headers=H, params={"library": "common"}, timeout=15)
        assert r.status_code == 200
        ids = [f["id"] for f in r.json()]
        assert root["id"] in ids and child["id"] in ids

        # rename
        r = requests.patch(f"{API}/folders/{child['id']}", headers=H, json={"name": "TEST_Child2"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Child2"

        # move child to root (move_to_root)
        r = requests.patch(f"{API}/folders/{child['id']}", headers=H, json={"move_to_root": True}, timeout=15)
        assert r.status_code == 200
        assert r.json()["parent_id"] is None

        # move back under root
        r = requests.patch(f"{API}/folders/{child['id']}", headers=H, json={"parent_id": root["id"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["parent_id"] == root["id"]

        # cycle: move root into child -> 400
        r = requests.patch(f"{API}/folders/{root['id']}", headers=H, json={"parent_id": child["id"]}, timeout=15)
        assert r.status_code == 400
    finally:
        for cid in reversed(created):
            requests.delete(f"{API}/folders/{cid}", headers=H, timeout=15)


def test_cross_library_move_rejected(H, temp_profile):
    rc = requests.post(f"{API}/folders", headers=H, json={"name": "TEST_C", "library": "common"}, timeout=15).json()
    rm = requests.post(f"{API}/folders", headers=H,
                       json={"name": "TEST_M", "library": "mine", "profile_id": temp_profile}, timeout=15).json()
    try:
        # move common folder under a 'mine' folder -> 400
        r = requests.patch(f"{API}/folders/{rc['id']}", headers=H, json={"parent_id": rm["id"]}, timeout=15)
        assert r.status_code == 400
        # create a folder with parent of another scope -> 400
        r2 = requests.post(f"{API}/folders", headers=H,
                           json={"name": "TEST_X", "library": "common", "parent_id": rm["id"]}, timeout=15)
        assert r2.status_code == 400
    finally:
        requests.delete(f"{API}/folders/{rc['id']}", headers=H, timeout=15)
        requests.delete(f"{API}/folders/{rm['id']}", headers=H, timeout=15)


def test_delete_folder_keep_contents_moves_to_parent(H, temp_profile):
    # mine library: root -> child, upload doc into child, delete child -> doc should go to root
    root = requests.post(f"{API}/folders", headers=H,
                         json={"name": "TEST_Parent", "library": "mine", "profile_id": temp_profile}, timeout=15).json()
    child = requests.post(f"{API}/folders", headers=H,
                          json={"name": "TEST_ToDel", "library": "mine", "profile_id": temp_profile,
                                "parent_id": root["id"]}, timeout=15).json()
    # upload a tiny docx into child
    files = {"files": ("TEST_in_child.docx", b"PK\x03\x04dummy",
                       "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    up = requests.post(f"{API}/documents/upload", headers=H, files=files,
                       data={"library": "mine", "profile_id": temp_profile, "folder_id": child["id"]}, timeout=30)
    assert up.status_code == 200, up.text
    doc_id = up.json()[0]["id"]
    # add a subfolder under child too
    sub = requests.post(f"{API}/folders", headers=H,
                        json={"name": "TEST_Sub", "library": "mine", "profile_id": temp_profile,
                              "parent_id": child["id"]}, timeout=15).json()
    try:
        # delete child
        rd = requests.delete(f"{API}/folders/{child['id']}", headers=H, params={"keep_contents": "true"}, timeout=20)
        assert rd.status_code == 200
        body = rd.json()
        assert body["moved_documents"] == 1
        assert body["moved_folders"] == 1
        assert body["parent_id"] == root["id"]
        # the doc should now live under root
        docs = requests.get(f"{API}/documents", headers=H,
                            params={"library": "mine", "profile_id": temp_profile}, timeout=15).json()
        d = next(x for x in docs if x["id"] == doc_id)
        assert d["folder_id"] == root["id"], d
        # the sub-folder should now have parent_id == root
        folders = requests.get(f"{API}/folders", headers=H,
                               params={"library": "mine", "profile_id": temp_profile}, timeout=15).json()
        s = next(x for x in folders if x["id"] == sub["id"])
        assert s["parent_id"] == root["id"]
    finally:
        requests.delete(f"{API}/documents/{doc_id}", headers=H, timeout=15)
        requests.delete(f"{API}/folders/{sub['id']}", headers=H, timeout=15)
        requests.delete(f"{API}/folders/{root['id']}", headers=H, timeout=15)


def test_upload_with_folder_from_other_library_rejected(H, temp_profile):
    cf = requests.post(f"{API}/folders", headers=H, json={"name": "TEST_Up", "library": "common"}, timeout=15).json()
    try:
        files = {"files": ("TEST_wrong.docx", b"PK\x03\x04",
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        r = requests.post(f"{API}/documents/upload", headers=H, files=files,
                          data={"library": "mine", "profile_id": temp_profile, "folder_id": cf["id"]}, timeout=20)
        assert r.status_code == 400
    finally:
        requests.delete(f"{API}/folders/{cf['id']}", headers=H, timeout=15)


def test_document_move_cross_library_rejected(H, temp_profile):
    # upload a common doc, create a mine folder, try to move it there -> 400
    files = {"files": ("TEST_commondoc.docx", b"PK\x03\x04",
                       "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    up = requests.post(f"{API}/documents/upload", headers=H, files=files,
                       data={"library": "common"}, timeout=30)
    assert up.status_code == 200
    doc_id = up.json()[0]["id"]
    mf = requests.post(f"{API}/folders", headers=H,
                       json={"name": "TEST_MineF", "library": "mine", "profile_id": temp_profile}, timeout=15).json()
    try:
        r = requests.post(f"{API}/documents/{doc_id}/move", headers=H, json={"folder_id": mf["id"]}, timeout=15)
        assert r.status_code == 400
        # Move to None (root in own library) works
        r2 = requests.post(f"{API}/documents/{doc_id}/move", headers=H, json={"folder_id": None}, timeout=15)
        assert r2.status_code == 200
    finally:
        requests.delete(f"{API}/documents/{doc_id}", headers=H, timeout=15)
        requests.delete(f"{API}/folders/{mf['id']}", headers=H, timeout=15)


def test_deleting_profile_removes_its_folders(H):
    # create temp profile, add a folder, delete profile, assert folder gone
    pid = requests.post(f"{API}/profiles", headers=H,
                        json={"name": "TEST_DelMe", "color": "#112233"}, timeout=15).json()["id"]
    f = requests.post(f"{API}/folders", headers=H,
                      json={"name": "TEST_PF", "library": "mine", "profile_id": pid}, timeout=15).json()
    fid = f["id"]
    r = requests.delete(f"{API}/profiles/{pid}", headers=H, timeout=15)
    assert r.status_code == 200
    # The folder should not be present when listing by scope anymore
    # Can't easily query by id directly; use folders list filter by any library and look in both
    all_common = requests.get(f"{API}/folders", headers=H, params={"library": "common"}, timeout=15).json()
    assert not any(x["id"] == fid for x in all_common)
    # Trying to patch it -> 404
    r2 = requests.patch(f"{API}/folders/{fid}", headers=H, json={"name": "x"}, timeout=15)
    assert r2.status_code == 404


# ---------- web_sources extraction ----------
def test_chat_web_sources_non_empty_when_web_search_on(H):
    body = {"question": "¿Cuál es la prevalencia de la miopía en adolescentes en Europa?",
            "profile_id": PAULA_ID, "scope": "common", "web_search": True}
    r = requests.post(f"{API}/chat", headers=H, json=body, timeout=180)
    assert r.status_code == 200, r.text
    d = r.json()
    # Web search was on -> web_sources should be a non-empty list, each with a label
    assert isinstance(d["web_sources"], list), d
    assert len(d["web_sources"]) >= 1, d
    for w in d["web_sources"]:
        assert w.get("label", "").startswith("W")
        assert w.get("url") and w.get("title") is not None
    # cleanup
    requests.delete(f"{API}/conversations/{d['conversation_id']}", headers=H, timeout=15)


def test_delete_folder_removes_everything_inside(H, temp_profile):
    # root -> sub, with one doc in each; deleting root removes both folders and both docs
    root = requests.post(f"{API}/folders", headers=H,
                         json={"name": "TEST_DelAll", "library": "mine", "profile_id": temp_profile}, timeout=15).json()
    sub = requests.post(f"{API}/folders", headers=H,
                        json={"name": "TEST_DelAllSub", "library": "mine", "profile_id": temp_profile,
                              "parent_id": root["id"]}, timeout=15).json()
    ids = []
    for fid, name in ((root["id"], "TEST_a.docx"), (sub["id"], "TEST_b.docx")):
        files = {"files": (name, b"PK\x03\x04dummy",
                           "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        up = requests.post(f"{API}/documents/upload", headers=H, files=files,
                           data={"library": "mine", "profile_id": temp_profile, "folder_id": fid}, timeout=30)
        assert up.status_code == 200, up.text
        ids.append(up.json()[0]["id"])
    rd = requests.delete(f"{API}/folders/{root['id']}", headers=H, timeout=30)
    assert rd.status_code == 200, rd.text
    body = rd.json()
    assert body["deleted_documents"] == 2
    assert body["deleted_folders"] == 1
    docs = requests.get(f"{API}/documents", headers=H,
                        params={"library": "mine", "profile_id": temp_profile}, timeout=15).json()
    assert not any(d["id"] in ids for d in docs)
    folders = requests.get(f"{API}/folders", headers=H,
                           params={"library": "mine", "profile_id": temp_profile}, timeout=15).json()
    assert not any(f["id"] in (root["id"], sub["id"]) for f in folders)
