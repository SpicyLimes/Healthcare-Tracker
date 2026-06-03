def test_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "database" in body


def test_health_reports_database_status(client):
    response = client.get("/api/health")
    body = response.json()
    # In the test environment the DB may be up ("connected") or unreachable
    # ("unavailable"); either is a valid string, but the key must be present.
    assert body["database"] in {"connected", "unavailable"}
