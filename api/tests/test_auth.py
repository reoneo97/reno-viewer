from .conftest import TEST_USERNAME, TEST_PASSWORD


def test_login_valid(client):
    r = client.post("/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client):
    r = client.post("/auth/login", json={"username": TEST_USERNAME, "password": "wrongpassword"})
    assert r.status_code == 401


def test_login_wrong_username(client):
    r = client.post("/auth/login", json={"username": "nobody", "password": TEST_PASSWORD})
    assert r.status_code == 401


def test_protected_endpoint_without_token(client):
    r = client.get("/projects")
    assert r.status_code == 401


def test_protected_endpoint_with_invalid_token(client):
    r = client.get("/projects", headers={"Authorization": "Bearer notarealtoken"})
    assert r.status_code == 401
