"""Health endpoint tests (Phase 1: component status)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_ok_with_components() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "personal-ai-coding-agent-api"
    assert body["version"] == "0.2.0"
    components = body["components"]
    assert components["db"] == "ok"  # SQLite fallback always available locally
    assert components["redis"] in {"ok", "degraded", "disabled"}
    assert components["llm"] in {"ok", "disabled"}


def test_openapi_schema_lists_endpoints() -> None:
    client = TestClient(create_app())
    schema = client.get("/openapi.json")
    assert schema.status_code == 200
    paths = schema.json()["paths"]
    assert "/health" in paths
    assert "/api/repositories/clone" in paths
    assert "/api/chat" in paths


def test_clone_rejects_invalid_url_with_error_shape() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/repositories/clone", json={"repo_url": "git@github.com:owner/repo.git"}
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "INVALID_REPO_URL"
    assert "message" in detail
