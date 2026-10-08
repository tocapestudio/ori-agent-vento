import os
import sys
import threading
from datetime import date, timedelta
from pathlib import Path

import requests
from pymongo import MongoClient

API = sys.argv[1] + "/api"
D = Path(os.environ["BACKUP_DIR"])
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
COLS = ["profiles", "folders", "documents", "chunks", "conversations", "messages", "cheatsheets", "templates", "favorites"]
tok = requests.post(f"{API}/auth/access", json={"code": sys.argv[2]}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}

# Dummy old/recent backups (not real data) to verify retention
today = date.today()
dummies = {f"ori-backup-{(today - timedelta(days=n)).isoformat()}_0800.zip": n for n in (1, 2, 3, 5)}
for name in dummies:
    (D / name).write_bytes(b"dummy")
(D / "notes.txt").write_text("not a backup")

before = {c: db[c].count_documents({}) for c in COLS}
results = []
t = [threading.Thread(target=lambda: results.append(requests.post(f"{API}/backup/auto/run-now", headers=H))) for _ in range(2)]
[x.start() for x in t]
[x.join() for x in t]
codes = sorted(r.status_code for r in results)
ok = next(r.json() for r in results if r.status_code == 200)
print("concurrent run-now codes:", codes, "| file:", ok["file"], "| deleted:", sorted(ok["deleted"]))
left = sorted(p.name for p in D.iterdir())
print("files left:", left)
assert codes == [200, 409], codes
assert sorted(ok["deleted"]) == sorted(n for n, age in dummies.items() if age >= 3), ok["deleted"]
assert all(n in left for n, age in dummies.items() if age < 3) and "notes.txt" in left

st = requests.get(f"{API}/backup/auto", headers=H).json()
print("status last:", st["last"]["status"], st["last"]["reason"], "| listed:", [b["name"] for b in st["backups"]])
dl = requests.get(f"{API}/backup/auto/files/{ok['file']}", headers=H)
print("download:", dl.status_code, dl.headers.get("content-type"), len(dl.content))
print("bad name:", requests.get(f"{API}/backup/auto/files/..%2Fsecret.zip", headers=H).status_code)

imp = requests.post(f"{API}/backup/import", headers=H, files={"file": (ok["file"], dl.content)}, data={"mode": "merge"})
after = {c: db[c].count_documents({}) for c in COLS}
print("merge import:", imp.status_code, "| counts unchanged:", before == after)
assert imp.status_code == 200 and before == after

for name, age in dummies.items():
    (D / name).unlink(missing_ok=True)
(D / "notes.txt").unlink()
print("ALL OK")
