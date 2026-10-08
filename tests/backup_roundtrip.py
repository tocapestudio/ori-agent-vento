import hashlib
import os
import sys

import requests
from bson import json_util
from pymongo import MongoClient

API = sys.argv[1] + "/api"
COLS = ["profiles", "folders", "documents", "chunks", "conversations", "messages",
        "cheatsheets", "templates", "favorites", "orders", "settings"]
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
STORAGE = os.environ["STORAGE_DIR"]


def snapshot():
    out = {}
    for c in COLS:
        docs = sorted(json_util.dumps(d, sort_keys=True) for d in db[c].find({}))
        out[c] = (len(docs), hashlib.sha256("\n".join(docs).encode()).hexdigest()[:12])
    files = sorted(os.listdir(STORAGE))
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode())
        with open(os.path.join(STORAGE, f), "rb") as fh:
            h.update(fh.read())
    out["files"] = (len(files), h.hexdigest()[:12])
    return out


tok = requests.post(f"{API}/auth/access", json={"code": sys.argv[2]}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
before = snapshot()
r = requests.get(f"{API}/backup/export", headers=H)
r.raise_for_status()
open("/tmp/ori_backup_test.zip", "wb").write(r.content)
print("export bytes", len(r.content))
for mode in ("replace", "merge"):
    with open("/tmp/ori_backup_test.zip", "rb") as f:
        res = requests.post(f"{API}/backup/import", headers=H, files={"file": f}, data={"mode": mode})
    print(mode, res.status_code, res.json().get("restored"), res.json().get("files"))
    after = snapshot()
    diffs = {k: (before[k], after[k]) for k in before if before[k] != after[k]}
    print(mode, "IDENTICAL" if not diffs else f"DIFF {diffs}")
bad = requests.post(f"{API}/backup/import", headers=H, files={"file": ("x.zip", b"notazip")}, data={"mode": "merge"})
print("bad zip", bad.status_code, bad.json())
print("search works:", requests.post(f"{API}/search", headers=H, json={"query": "acomodación", "scope": "common"}).status_code)
