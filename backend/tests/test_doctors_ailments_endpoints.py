from app.models.user import Role
from app.services import user_service


def _admin_login(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_doctors_crud(client, db_session):
    csrf = _admin_login(client, db_session)
    created = client.post("/api/doctors", headers={"X-CSRF-Token": csrf},
                          json={"name": "Dr. Smith", "specialty": "Cardiology"})
    assert created.status_code == 201
    doc_id = created.json()["id"]
    assert client.get("/api/doctors").status_code == 200
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204


def test_ailments_crud_and_status_default(client, db_session):
    csrf = _admin_login(client, db_session)
    created = client.post("/api/ailments", headers={"X-CSRF-Token": csrf},
                          json={"condition": "Hypertension"})
    assert created.status_code == 201
    assert created.json()["status"] == "active"
    ail_id = created.json()["id"]
    updated = client.put(f"/api/ailments/{ail_id}", headers={"X-CSRF-Token": csrf},
                         json={"status": "resolved"})
    assert updated.json()["status"] == "resolved"
