"""Phase 2 (installer, docs, downloads, setup, network) backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://visual-therapy-agent.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
TEAM_CODE = "Orion9944+"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/access", json={"code": TEAM_CODE}, timeout=10)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Setup wizard (public) ----------
class TestSetupPublic:
    def test_setup_status_false_in_preview(self):
        r = requests.get(f"{API}/setup/status", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data == {"needs_setup": False}

    def test_setup_complete_returns_409_when_not_needed(self):
        r = requests.post(f"{API}/setup/complete",
                          json={"access_code": "ShouldNotMatter123", "gemini_api_key": None},
                          timeout=10)
        assert r.status_code == 409
        assert "ya se completó" in r.text or "already" in r.text.lower()


# ---------- System network/shutdown ----------
class TestSystem:
    def test_network_endpoint(self, auth_headers):
        r = requests.get(f"{API}/system/network", headers=auth_headers, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        # Expected shape in preview
        assert d["port"] is None
        assert isinstance(d["lan"], list)
        assert d["tailscale_ips"] == []
        assert d["tailscale_name"] is None
        assert isinstance(d["hostname"], str) and d["hostname"]
        assert d["can_shutdown"] is False

    def test_shutdown_400_in_preview(self, auth_headers):
        r = requests.post(f"{API}/system/shutdown", headers=auth_headers, timeout=10)
        assert r.status_code == 400


# ---------- Downloads ----------
class TestDownloads:
    def test_list_downloads(self, auth_headers):
        r = requests.get(f"{API}/downloads", headers=auth_headers, timeout=10)
        assert r.status_code == 200
        files = r.json()
        assert isinstance(files, list)
        names = {f["name"] for f in files}
        # These 4 must always be present
        expected = {"manual.pdf", "guia-casa.pdf", "guia-centro.pdf", "problemas.pdf"}
        assert expected.issubset(names), f"Missing: {expected - names}"
        for f in files:
            assert "size" in f and isinstance(f["size"], int) and f["size"] > 0

    @pytest.mark.parametrize("name", ["manual.pdf", "guia-casa.pdf", "guia-centro.pdf", "problemas.pdf"])
    def test_download_pdf(self, token, name):
        # Also test ?token= query auth path
        r = requests.get(f"{API}/downloads/{name}?token={token}", timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        # Must look like a PDF
        assert r.content[:4] == b"%PDF", f"Content for {name} is not a PDF: {r.content[:16]!r}"
        assert len(r.content) > 100

    def test_download_with_bearer_token(self, auth_headers):
        r = requests.get(f"{API}/downloads/manual.pdf", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_path_traversal_encoded_slash_404(self, auth_headers):
        # ..%2Fsecret → should hit the handler with name containing '/' decoded; expect 404
        r = requests.get(f"{API}/downloads/..%2Fsecret", headers=auth_headers, timeout=10, allow_redirects=False)
        assert r.status_code == 404

    def test_path_traversal_dotdot_404(self, auth_headers):
        r = requests.get(f"{API}/downloads/..%2F..%2Fetc%2Fpasswd", headers=auth_headers, timeout=10, allow_redirects=False)
        assert r.status_code == 404

    def test_hidden_file_404(self, auth_headers):
        r = requests.get(f"{API}/downloads/.hidden", headers=auth_headers, timeout=10)
        assert r.status_code == 404

    def test_nonexistent_404(self, auth_headers):
        r = requests.get(f"{API}/downloads/does-not-exist.pdf", headers=auth_headers, timeout=10)
        assert r.status_code == 404


# ---------- Docs served statically (via public, /docs/*.md consumed by HelpPage) ----------
class TestDocs:
    @pytest.mark.parametrize("slug", ["manual", "guia-casa", "guia-centro", "problemas"])
    def test_markdown_docs_served(self, slug):
        r = requests.get(f"{BASE_URL}/docs/{slug}.md", timeout=10)
        # Served by frontend static (not /api). Allow 200 only.
        assert r.status_code == 200, f"/docs/{slug}.md not reachable: {r.status_code}"
        assert len(r.text) > 10
