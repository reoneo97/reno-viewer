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


def test_anchor_notes_create_and_read(client, auth_headers, project):
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 40.0, "y": 40.0, "label": "Bathroom Mirror", "notes": "Check wall studs first"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["notes"] == "Check wall studs first"
    # cleanup
    client.delete(f"/anchors/{body['id']}", headers=auth_headers)


def test_anchor_notes_update(client, auth_headers, anchor):
    r = client.patch(
        f"/anchors/{anchor['id']}",
        json={"notes": "Updated note"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["notes"] == "Updated note"


def test_anchor_notes_clear(client, auth_headers, anchor):
    client.patch(f"/anchors/{anchor['id']}", json={"notes": "Initial"}, headers=auth_headers)
    r = client.patch(f"/anchors/{anchor['id']}", json={"notes": None}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["notes"] is None


def test_anchor_notes_default_null(client, auth_headers, project):
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 10.0, "y": 10.0, "label": "No Notes"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    body = r.json()
    assert body["notes"] is None
    client.delete(f"/anchors/{body['id']}", headers=auth_headers)


def test_duplicate_anchor_basic(client, auth_headers, anchor):
    r = client.post(f"/anchors/{anchor['id']}/duplicate", headers=auth_headers)
    assert r.status_code == 201
    dup = r.json()
    assert dup["id"] != anchor["id"]
    assert dup["label"] == f"{anchor['label']} (copy)"
    assert dup["project_id"] == anchor["project_id"]
    # cleanup
    client.delete(f"/anchors/{dup['id']}", headers=auth_headers)


def test_duplicate_anchor_offset_position(client, auth_headers, anchor):
    r = client.post(f"/anchors/{anchor['id']}/duplicate", headers=auth_headers)
    dup = r.json()
    assert dup["x"] != anchor["x"] or dup["y"] != anchor["y"]
    client.delete(f"/anchors/{dup['id']}", headers=auth_headers)


def test_duplicate_anchor_copies_category_and_notes(client, auth_headers, project):
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 20.0, "y": 20.0, "label": "Sofa", "category": "Furniture", "notes": "Check clearance"},
        headers=auth_headers,
    )
    anchor_id = r.json()["id"]
    dup = client.post(f"/anchors/{anchor_id}/duplicate", headers=auth_headers).json()
    assert dup["category"] == "Furniture"
    assert dup["notes"] == "Check clearance"
    client.delete(f"/anchors/{anchor_id}", headers=auth_headers)
    client.delete(f"/anchors/{dup['id']}", headers=auth_headers)


def test_duplicate_anchor_position_clamped(client, auth_headers, project):
    # An anchor near the edge should not push the duplicate out of bounds.
    r = client.post(
        f"/projects/{project['id']}/anchors",
        json={"x": 98.0, "y": 98.0, "label": "Edge Anchor"},
        headers=auth_headers,
    )
    anchor_id = r.json()["id"]
    dup = client.post(f"/anchors/{anchor_id}/duplicate", headers=auth_headers).json()
    assert dup["x"] <= 98.0
    assert dup["y"] <= 98.0
    client.delete(f"/anchors/{anchor_id}", headers=auth_headers)
    client.delete(f"/anchors/{dup['id']}", headers=auth_headers)


def test_duplicate_anchor_not_found(client, auth_headers):
    r = client.post(
        "/anchors/00000000-0000-0000-0000-000000000000/duplicate",
        headers=auth_headers,
    )
    assert r.status_code == 404


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
