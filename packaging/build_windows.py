"""Builds the self-contained Windows installer (OriSetup.exe) from this Linux environment."""
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BUILD = HERE / "build"
APP = BUILD / "app"
PY = APP / "python"
SITE = PY / "Lib" / "site-packages"
OUT = Path(os.environ.get("ORI_OUT", ROOT / "downloads" / "OriSetup.exe"))
PY_URL = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip"
MONGO_URL = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.14.zip"


def log(msg):
    print(f"[build] {msg}", flush=True)


def fetch(url, dest):
    if not dest.exists():
        log(f"descargando {url}")
        urllib.request.urlretrieve(url, dest)
    return dest


def python_embed():
    z = fetch(PY_URL, BUILD / "py.zip")
    zipfile.ZipFile(z).extractall(PY)
    (PY / "python311._pth").write_text("python311.zip\n.\nLib\\site-packages\n..\\backend\nimport site\n")
    SITE.mkdir(parents=True, exist_ok=True)


PIP_WIN = ["--platform", "win_amd64", "--python-version", "3.11", "--implementation", "cp", "--abi", "cp311", "--only-binary=:all:"]
WIN_ENV = {"sys_platform": "win32", "platform_system": "Windows", "os_name": "nt", "platform_machine": "AMD64",
           "python_version": "3.11", "python_full_version": "3.11.9", "implementation_name": "cpython",
           "platform_python_implementation": "CPython", "platform_release": "10", "platform_version": "10.0.22631"}
EXTRA_WHEELS = []


def wheels():
    wd = BUILD / "wheels"
    subprocess.run([sys.executable, "-m", "pip", "download", "-q", "-r", str(HERE / "requirements-win.txt"), "-d", str(wd), *PIP_WIN], check=True)
    for whl in sorted(wd.glob("*.whl")):
        install_wheel(whl, PY, SITE)
    log(f"{len(list(wd.glob('*.whl')))} paquetes instalados")


def installed_dists():
    from email.parser import Parser

    from packaging.utils import canonicalize_name
    out = {}
    for di in SITE.glob("*.dist-info"):
        meta = Parser().parsestr((di / "METADATA").read_text(encoding="utf-8", errors="replace"))
        out[canonicalize_name(meta["Name"])] = (meta["Version"], meta.get_all("Requires-Dist") or [])
    return out


def missing_windows_reqs():
    """Walks Requires-Dist from requirements-win.txt evaluating markers as Windows; returns unmet requirements."""
    from packaging.requirements import Requirement
    from packaging.utils import canonicalize_name
    inst = installed_dists()
    queue = [Requirement(line) for line in (HERE / "requirements-win.txt").read_text().splitlines() if line.strip()]
    seen, missing = set(), []
    while queue:
        req = queue.pop()
        name = canonicalize_name(req.name)
        if (name, frozenset(req.extras)) in seen:
            continue
        seen.add((name, frozenset(req.extras)))
        if name not in inst:
            missing.append(str(req))
            continue
        ver, deps = inst[name]
        if req.specifier and not req.specifier.contains(ver, prereleases=True):
            raise SystemExit(f"Versión incompatible para Windows: {req} (en el paquete: {ver})")
        for d in deps:
            dr = Requirement(d)
            if dr.marker is None or any(dr.marker.evaluate({**WIN_ENV, "extra": e}) for e in [*req.extras, ""]):
                queue.append(dr)
    log(f"auditoría: {len(seen)} requisitos comprobados con marcadores de Windows")
    return missing


def windows_deps():
    wd = BUILD / "wheels_extra"
    for _ in range(6):
        miss = missing_windows_reqs()
        if not miss:
            log(f"dependencias de Windows completas (añadidas: {[w.name for w in EXTRA_WHEELS] or 'ninguna'})")
            return
        log(f"faltan en Windows: {miss}")
        before = set(wd.glob("*.whl")) if wd.exists() else set()
        from packaging.requirements import Requirement
        plain = [f"{r.name}{r.specifier}" for r in map(Requirement, miss)]
        subprocess.run([sys.executable, "-m", "pip", "download", "-q", "--no-deps", "-d", str(wd), *PIP_WIN, *plain], check=True)
        for whl in sorted(set(wd.glob("*.whl")) - before):
            install_wheel(whl, PY, SITE)
            EXTRA_WHEELS.append(whl)
    raise SystemExit("No se pudieron completar las dependencias de Windows")


def import_scan():
    """Static scan: module-level imports (also inside if-blocks, not try) of bundled packages that nothing provides."""
    import ast
    provided = set(sys.stdlib_module_names) | {p.name.split(".")[0] for p in SITE.iterdir()} | {p.stem.split(".")[0] for p in PY.glob("*.pyd")}
    provided |= {"_" + n for n in provided}
    issues = {}

    def walk(nodes, path):
        for n in nodes:
            if isinstance(n, (ast.Import, ast.ImportFrom)) and not (isinstance(n, ast.ImportFrom) and n.level):
                for name in ([a.name for a in n.names] if isinstance(n, ast.Import) else [n.module or ""]):
                    top = name.split(".")[0]
                    if top and top not in provided:
                        issues.setdefault(top, set()).add(str(path.relative_to(SITE)).split("/")[0])
            elif isinstance(n, ast.If):
                walk(n.body + n.orelse, path)

    for f in SITE.rglob("*.py"):
        if "/tests/" in str(f) or "/test/" in str(f):
            continue
        try:
            walk(ast.parse(f.read_bytes()).body, f)
        except (SyntaxError, ValueError):
            continue
    for mod, users in sorted(issues.items()):
        log(f"import sin proveedor: {mod} <- {sorted(users)[:4]}")
    return issues


def install_wheel(whl, py_root, site):
    with zipfile.ZipFile(whl) as z:
        for n in z.namelist():
            parts = n.split("/")
            if parts[0].endswith(".data") and len(parts) > 2:
                kind, rel = parts[1], "/".join(parts[2:])
                if kind == "scripts" or not rel:
                    continue
                dest = (py_root if kind == "data" else site) / rel
            else:
                dest = site / n
            if n.endswith("/"):
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            with z.open(n) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)


def mongo():
    z = fetch(MONGO_URL, BUILD / "mongo.zip")
    (APP / "mongodb").mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(z) as zf:
        for n in zf.namelist():
            if n.endswith("/bin/mongod.exe"):
                with zf.open(n) as src, open(APP / "mongodb" / "mongod.exe", "wb") as out:
                    shutil.copyfileobj(src, out)
    (BUILD / "mongo.zip").unlink()
    for dll in PY.glob("*.dll"):
        if dll.name.lower().startswith(("msvcp", "vcruntime", "concrt", "vcomp", "vccorlib")):
            shutil.copy2(dll, APP / "mongodb" / dll.name)


def backend():
    dest = APP / "backend"
    dest.mkdir(parents=True, exist_ok=True)
    for f in (ROOT / "backend").glob("*.py"):
        shutil.copy2(f, dest / f.name)
    models = ROOT / "backend" / ".models"
    for f in models.rglob("*"):
        target = APP / "models" / f.relative_to(models)
        if f.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            try:
                os.link(f.resolve(), target)
            except OSError:
                shutil.copy2(f, target)


def frontend():
    env = dict(os.environ, REACT_APP_BACKEND_URL="", BUILD_PATH=str(APP / "frontend"), GENERATE_SOURCEMAP="false", CI="false")
    subprocess.run(["yarn", "build"], cwd=ROOT / "frontend", env=env, check=True, stdout=subprocess.DEVNULL)


def extras():
    shutil.copy2(HERE / "launcher.py", APP / "launcher.py")
    shutil.copy2(HERE / "diagnostico.bat", APP / "diagnostico.bat")
    shutil.copy2(ROOT / "frontend" / "public" / "ori.ico", APP / "ori.ico")
    (APP / "downloads").mkdir(exist_ok=True)
    for pdf in (ROOT / "downloads").glob("*.pdf"):
        shutil.copy2(pdf, APP / "downloads" / pdf.name)


def patch():
    """Small OriParche.exe for existing installs: missing Windows packages + launcher + diagnostics + backend + frontend."""
    pd = BUILD / "patch"
    shutil.rmtree(pd, ignore_errors=True)
    for whl in EXTRA_WHEELS:
        install_wheel(whl, pd / "python", pd / "python" / "Lib" / "site-packages")
    shutil.copytree(APP / "backend", pd / "backend")
    shutil.copytree(APP / "frontend", pd / "frontend")
    for f in ("launcher.py", "diagnostico.bat", "ori.ico"):
        shutil.copy2(APP / f, pd / f)
    out = OUT.parent / "OriParche.exe"
    subprocess.run(["makensis", "-V2", f"-DOUTFILE={out}", str(HERE / "parche.nsi")], cwd=HERE, check=True)
    log(f"parche listo: {out} ({out.stat().st_size / 1e6:.1f} MB)")


def nsis():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp.exe")
    subprocess.run(["makensis", "-V2", f"-DOUTFILE={tmp}", str(HERE / "ori.nsi")], cwd=HERE, check=True)
    tmp.replace(OUT)
    log(f"instalador listo: {OUT} ({OUT.stat().st_size / 1e9:.2f} GB)")


if __name__ == "__main__":
    shutil.rmtree(APP, ignore_errors=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    only_deps = "--deps-only" in sys.argv
    steps = (python_embed, wheels, windows_deps, import_scan) if only_deps else (python_embed, wheels, windows_deps, import_scan, mongo, backend, frontend, extras, patch, nsis)
    for step in steps:
        log(step.__name__)
        step()
    if "--keep" not in sys.argv and not only_deps:
        shutil.rmtree(BUILD)
    log("OK")
