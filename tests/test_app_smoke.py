from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_health():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
