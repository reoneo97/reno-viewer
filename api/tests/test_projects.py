def test_create_project(client, auth_headers):
    r = client.post("/projects", json={"name": "My Flat"}, headers=auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "My Flat"
    assert body["anchors"] == []
    assert body["floor_plan_url"] is None
    # cleanup
    client.delete(f"/projects/{body['id']}", headers=auth_headers)


def test_get_project(client, auth_headers, project):
    r = client.get(f"/projects/{project['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == project["id"]
    assert r.json()["name"] == project["name"]


def test_get_project_not_found(client, auth_headers):
    r = client.get("/projects/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert r.status_code == 404


def test_list_projects(client, auth_headers, project):
    r = client.get("/projects", headers=auth_headers)
    assert r.status_code == 200
    ids = [p["id"] for p in r.json()]
    assert project["id"] in ids


def test_update_project(client, auth_headers, project):
    r = client.patch(
        f"/projects/{project['id']}",
        json={"name": "Renamed Flat"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Flat"


def test_delete_project(client, auth_headers):
    r = client.post("/projects", json={"name": "To Delete"}, headers=auth_headers)
    project_id = r.json()["id"]
    r = client.delete(f"/projects/{project_id}", headers=auth_headers)
    assert r.status_code == 204
    r = client.get(f"/projects/{project_id}", headers=auth_headers)
    assert r.status_code == 404
