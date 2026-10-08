import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://visual-therapy-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
CODE = "Orion9944+"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/access", json={"code": CODE})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


def test_orders_requires_auth():
    r = requests.get(f"{API}/orders/templates:shared")
    assert r.status_code in (401, 403)


def test_orders_unknown_key_returns_empty(h):
    key = "test:unknown:xyz"
    r = requests.get(f"{API}/orders/{key}", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["key"] == key
    assert data["ids"] == []


def test_orders_put_persists_and_reload(h):
    key = "test:phase6:persist"
    ids = ["a", "b", "c"]
    r = requests.put(f"{API}/orders/{key}", json={"ids": ids}, headers=h)
    assert r.status_code == 200
    assert r.json()["ids"] == ids
    # reload
    r2 = requests.get(f"{API}/orders/{key}", headers=h)
    assert r2.status_code == 200
    assert r2.json()["ids"] == ids
    # overwrite
    r3 = requests.put(f"{API}/orders/{key}", json={"ids": ["c", "a"]}, headers=h)
    assert r3.status_code == 200
    r4 = requests.get(f"{API}/orders/{key}", headers=h)
    assert r4.json()["ids"] == ["c", "a"]


def test_orders_invalid_keys(h):
    # Note: "bad/key" would be a routing 404 (slash splits path); covered by valid regex check.
    for bad in ["bad key", "bad!", "bad@x", "bad$x"]:
        r = requests.get(f"{API}/orders/{bad}", headers=h)
        assert r.status_code == 400, f"GET {bad} -> {r.status_code}"
        r2 = requests.put(f"{API}/orders/{bad}", json={"ids": []}, headers=h)
        assert r2.status_code == 400, f"PUT {bad} -> {r2.status_code}"


def test_orders_valid_key_formats(h):
    for good in ["templates:shared", "cheats:common", "favorites:shared",
                 "calcs:6ac681af4c6b10bd64f5d546", "lib:common:root:docs",
                 "lib:common:abc.def-123:folders", "quick:6ac681af4c6b10bd64f5d546"]:
        r = requests.get(f"{API}/orders/{good}", headers=h)
        assert r.status_code == 200, f"{good} -> {r.status_code}"
