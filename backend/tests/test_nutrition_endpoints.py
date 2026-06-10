# backend/tests/test_nutrition_endpoints.py
"""Endpoint tests for the nutrition plan API."""
import uuid

from app.models.user import Role
from app.services import user_service


def _login_admin(client, db):
    user_service.create_user(db, "admin@nutrition.example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@nutrition.example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _login_viewer(client, db):
    user_service.create_user(db, "viewer@nutrition.example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "viewer@nutrition.example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


# ---------------------------------------------------------------------------
# Meals
# ---------------------------------------------------------------------------

def test_meals_crud(client, db_session):
    csrf = _login_admin(client, db_session)

    # create
    r = client.post("/api/nutrition/meals", headers={"X-CSRF-Token": csrf},
                    json={"food_name": "Oatmeal", "meal_type": "breakfast"})
    assert r.status_code == 201, r.text
    mid = r.json()["id"]
    assert r.json()["food_name"] == "Oatmeal"
    assert r.json()["meal_type"] == "breakfast"

    # list
    r = client.get("/api/nutrition/meals")
    assert r.status_code == 200
    assert any(m["id"] == mid for m in r.json())

    # list filtered
    r = client.get("/api/nutrition/meals?meal_type=breakfast")
    assert r.status_code == 200
    assert all(m["meal_type"] == "breakfast" for m in r.json())

    # delete
    r = client.delete(f"/api/nutrition/meals/{mid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204

    # confirm gone
    r = client.get("/api/nutrition/meals")
    assert all(m["id"] != mid for m in r.json())


def test_meals_viewer_read_only(client, db_session):
    csrf = _login_admin(client, db_session)
    client.post("/api/nutrition/meals", headers={"X-CSRF-Token": csrf},
                json={"food_name": "Eggs", "meal_type": "breakfast"})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    viewer_csrf = _login_viewer(client, db_session)
    assert client.get("/api/nutrition/meals").status_code == 200
    r = client.post("/api/nutrition/meals", headers={"X-CSRF-Token": viewer_csrf},
                    json={"food_name": "Toast", "meal_type": "breakfast"})
    assert r.status_code == 403


def test_meals_csrf_required(client, db_session):
    _login_admin(client, db_session)
    r = client.post("/api/nutrition/meals", json={"food_name": "Toast", "meal_type": "breakfast"})
    assert r.status_code == 403


def test_meals_unauthenticated(client, db_session):
    assert client.get("/api/nutrition/meals").status_code == 401


def test_meals_delete_404(client, db_session):
    csrf = _login_admin(client, db_session)
    assert client.delete(f"/api/nutrition/meals/{uuid.uuid4()}", headers={"X-CSRF-Token": csrf}).status_code == 404


# ---------------------------------------------------------------------------
# Acceptable foods
# ---------------------------------------------------------------------------

def test_acceptable_foods_crud(client, db_session):
    csrf = _login_admin(client, db_session)

    # create
    r = client.post("/api/nutrition/acceptable-foods", headers={"X-CSRF-Token": csrf},
                    json={"food_name": "Banana"})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    assert r.json()["food_name"] == "Banana"
    assert r.json()["for_breakfast"] is False

    # list
    r = client.get("/api/nutrition/acceptable-foods")
    assert r.status_code == 200
    assert any(f["id"] == fid for f in r.json())

    # patch
    r = client.patch(f"/api/nutrition/acceptable-foods/{fid}", headers={"X-CSRF-Token": csrf},
                     json={"for_breakfast": True, "food_name": "Banana (ripe)"})
    assert r.status_code == 200
    assert r.json()["for_breakfast"] is True
    assert r.json()["food_name"] == "Banana (ripe)"

    # delete
    r = client.delete(f"/api/nutrition/acceptable-foods/{fid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204

    r = client.get("/api/nutrition/acceptable-foods")
    assert all(f["id"] != fid for f in r.json())


def test_acceptable_foods_viewer_read_only(client, db_session):
    csrf = _login_admin(client, db_session)
    client.post("/api/nutrition/acceptable-foods", headers={"X-CSRF-Token": csrf},
                json={"food_name": "Apple"})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    viewer_csrf = _login_viewer(client, db_session)
    assert client.get("/api/nutrition/acceptable-foods").status_code == 200
    assert client.post("/api/nutrition/acceptable-foods", headers={"X-CSRF-Token": viewer_csrf},
                       json={"food_name": "Pear"}).status_code == 403


def test_acceptable_foods_unauthenticated(client, db_session):
    assert client.get("/api/nutrition/acceptable-foods").status_code == 401


def test_acceptable_foods_404(client, db_session):
    csrf = _login_admin(client, db_session)
    missing = uuid.uuid4()
    assert client.patch(f"/api/nutrition/acceptable-foods/{missing}",
                        headers={"X-CSRF-Token": csrf}, json={"food_name": "X"}).status_code == 404
    assert client.delete(f"/api/nutrition/acceptable-foods/{missing}",
                         headers={"X-CSRF-Token": csrf}).status_code == 404


# ---------------------------------------------------------------------------
# Unacceptable foods
# ---------------------------------------------------------------------------

def test_unacceptable_foods_crud(client, db_session):
    csrf = _login_admin(client, db_session)

    # create
    r = client.post("/api/nutrition/unacceptable-foods", headers={"X-CSRF-Token": csrf},
                    json={"food_name": "Fried chicken"})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    assert r.json()["food_name"] == "Fried chicken"

    # list
    r = client.get("/api/nutrition/unacceptable-foods")
    assert r.status_code == 200
    assert any(f["id"] == fid for f in r.json())

    # patch
    r = client.patch(f"/api/nutrition/unacceptable-foods/{fid}", headers={"X-CSRF-Token": csrf},
                     json={"food_name": "Fried chicken (all kinds)"})
    assert r.status_code == 200
    assert r.json()["food_name"] == "Fried chicken (all kinds)"

    # delete
    r = client.delete(f"/api/nutrition/unacceptable-foods/{fid}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204

    r = client.get("/api/nutrition/unacceptable-foods")
    assert all(f["id"] != fid for f in r.json())


def test_unacceptable_foods_viewer_read_only(client, db_session):
    csrf = _login_admin(client, db_session)
    client.post("/api/nutrition/unacceptable-foods", headers={"X-CSRF-Token": csrf},
                json={"food_name": "Soda"})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    viewer_csrf = _login_viewer(client, db_session)
    assert client.get("/api/nutrition/unacceptable-foods").status_code == 200
    assert client.post("/api/nutrition/unacceptable-foods", headers={"X-CSRF-Token": viewer_csrf},
                       json={"food_name": "Candy"}).status_code == 403


def test_unacceptable_foods_unauthenticated(client, db_session):
    assert client.get("/api/nutrition/unacceptable-foods").status_code == 401


def test_unacceptable_foods_404(client, db_session):
    csrf = _login_admin(client, db_session)
    missing = uuid.uuid4()
    assert client.patch(f"/api/nutrition/unacceptable-foods/{missing}",
                        headers={"X-CSRF-Token": csrf}, json={"food_name": "X"}).status_code == 404
    assert client.delete(f"/api/nutrition/unacceptable-foods/{missing}",
                         headers={"X-CSRF-Token": csrf}).status_code == 404
