def test_create_anchor(client, auth_headers, project):
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 50.0, "y": 25.0, "label": "Dining Table", "category": "Furniture"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "Dining Table"
    assert body["category"] == "Furniture"
    assert body["x"] == 50.0
    assert body["candidates"] == []
    # cleanup
    client.delete(f"/anchors/{body['id']}", headers=auth_headers)


def test_create_anchor_project_not_found(client, auth_headers):
    r = client.post(
        "/projects/00000000-0000-0000-0000-000000000000/anchors",
        json={"x": 10.0, "y": 10.0, "label": "Ghost"},
        headers=auth_headers,
    )
    assert r.status_code == 404


def test_anchor_appears_in_project(client, auth_headers, anchor, project):
    r = client.get(f"/projects/{project['id']}", headers=auth_headers)
    anchor_ids = [a["id"] for a in r.json()["anchors"]]
    assert anchor["id"] in anchor_ids


def test_update_anchor(client, auth_headers, anchor):
    r = client.patch(
        f"/anchors/{anchor['id']}",
        json={"label": "Updated Label", "x": 99.0},
        headers=auth_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["label"] == "Updated Label"
    assert body["x"] == 99.0


def test_delete_anchor(client, auth_headers, project):
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 1.0, "y": 1.0, "label": "Temporary"},
        headers=auth_headers,
    )
    anchor_id = r.json()["id"]
    r = client.delete(f"/anchors/{anchor_id}", headers=auth_headers)
    assert r.status_code == 204


def test_delete_project_cascades_anchors(client, auth_headers):
    # Create a project with an anchor, delete the project, anchor should be gone
    proj = client.post("/projects", json={"name": "Cascade Test"}, headers=auth_headers).json()
    anch = client.post(
        f"/projects/{proj['id']}/anchors",
        json={"x": 10.0, "y": 10.0, "label": "Will cascade"},
        headers=auth_headers,
    ).json()

    client.delete(f"/projects/{proj['id']}", headers=auth_headers)

    r = client.patch(f"/anchors/{anch['id']}", json={"label": "Gone"}, headers=auth_headers)
    assert r.status_code == 404
