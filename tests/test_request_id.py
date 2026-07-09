from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_response_has_request_id():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-ID")


def test_request_id_is_echoed_when_provided():
    resp = client.get("/", headers={"X-Request-ID": "abc-123"})
    assert resp.headers.get("X-Request-ID") == "abc-123"
