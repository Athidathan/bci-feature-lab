"""Metadata endpoint checks."""
from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app


def test_session_metadata_for_the_user_epochs():
    with TestClient(app) as client:
        response = client.get("/api/session")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["classes"]) == 4
    assert len(payload["channels"]) == 22
    assert [(item["name"], item["count"]) for item in payload["classes"]] == [
        ("Left Hand", 72), ("Right Hand", 72), ("Feet", 72), ("Tongue", 72)
    ]
