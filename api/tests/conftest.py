import pytest
from fastapi.testclient import TestClient
from src.main import app

# Plaintext password matching the hash in .env
TEST_USERNAME = "reo"
TEST_PASSWORD = "hwee"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def auth_headers(client):
    r = client.post("/auth/login", json={"username": TEST_USERNAME, "password": TEST_PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def project(client, auth_headers):
    """Creates a project for a test and deletes it afterward."""
    r = client.post("/projects", json={"name": "Test Project"}, headers=auth_headers)
    assert r.status_code == 201
    data = r.json()
    yield data
    client.delete(f"/projects/{data['id']}", headers=auth_headers)


@pytest.fixture
def anchor(client, auth_headers, project):
    """Creates an anchor within the test project and deletes it afterward."""
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 45.0, "y": 30.0, "label": "Test Anchor"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    data = r.json()
    yield data
    # Anchor is deleted via project cascade, but clean up explicitly if project survives
    client.delete(f"/anchors/{data['id']}", headers=auth_headers)
