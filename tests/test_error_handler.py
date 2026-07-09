from fastapi.testclient import TestClient

from backend.main import app

# Register a route that always raises, for testing the global handler.
@app.get("/api/_boom_test")
def _boom():
    raise RuntimeError("kaboom")


client = TestClient(app, raise_server_exceptions=False)


def test_unhandled_exception_returns_clean_500():
    resp = client.get("/api/_boom_test")
    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"] == "Internal error"
    assert body["request_id"]  # non-empty
    assert "kaboom" not in resp.text  # no internals leaked
