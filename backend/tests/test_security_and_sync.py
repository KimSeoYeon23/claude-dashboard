import tarfile
from contextlib import contextmanager
from io import BytesIO
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException
from starlette.datastructures import UploadFile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.routes import summarize, sync
from backend.services import auth


def make_upload(name: str, content: bytes) -> UploadFile:
    return UploadFile(filename=name, file=BytesIO(content))


def make_tar_bytes(member_name: str, payload: bytes = b"test") -> bytes:
    buf = BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        info = tarfile.TarInfo(member_name)
        info.size = len(payload)
        tar.addfile(info, BytesIO(payload))
    return buf.getvalue()


def test_resolve_api_user_rejects_mismatched_requested_user(monkeypatch):
    monkeypatch.setattr(auth, "resolve_token", lambda token: "alice")

    with pytest.raises(HTTPException) as exc:
        auth.resolve_api_user("bob", "Bearer valid-token")

    assert exc.value.status_code == 403


def test_api_session_summary_queries_with_username_scope(monkeypatch):
    calls = {}

    @contextmanager
    def fake_conn():
        class Cursor:
            def execute(self, query, params):
                calls["query"] = query
                calls["params"] = params

            def fetchone(self):
                return {"summary": "cached summary"}

        yield Cursor()

    monkeypatch.setattr(summarize, "get_conn", fake_conn)

    monkeypatch.setattr(summarize, "resolve_api_user", lambda user, authorization: "alice")

    result = summarize.api_session_summary("session-1", user="alice", authorization=None)

    assert result == {"summary": "cached summary"}
    assert "username = %s" in calls["query"]
    assert calls["params"] == ("session-1", "alice")


@pytest.mark.anyio
async def test_api_sync_invalid_tar_path_preserves_400(monkeypatch, tmp_path):
    monkeypatch.setattr(sync, "DATA_DIR", tmp_path)
    monkeypatch.setattr(sync, "resolve_token", lambda token: "alice")
    monkeypatch.setattr(sync, "notify_user", lambda *args, **kwargs: None)

    bad_tar = make_upload("projects.tar.gz", make_tar_bytes("../escape.txt"))

    with pytest.raises(HTTPException) as exc:
        await sync.api_sync(
            stats=None,
            history=None,
            projects=bad_tar,
            authorization="Bearer valid-token",
            status=None,
            error_message=None,
            projects_mode="replace",
        )

    assert exc.value.status_code == 400


@pytest.mark.anyio
async def test_api_sync_replace_mode_clears_stale_projects_without_archive(monkeypatch, tmp_path):
    monkeypatch.setattr(sync, "DATA_DIR", tmp_path)
    monkeypatch.setattr(sync, "resolve_token", lambda token: "alice")
    monkeypatch.setattr(sync, "notify_user", lambda *args, **kwargs: None)

    stale_file = tmp_path / "alice" / "projects" / "demo" / "old.jsonl"
    stale_file.parent.mkdir(parents=True, exist_ok=True)
    stale_file.write_text("stale", encoding="utf-8")

    result = await sync.api_sync(
        stats=None,
        history=None,
        projects=None,
        authorization="Bearer valid-token",
        status=None,
        error_message=None,
        projects_mode="replace",
    )

    assert result["ok"] is True
    assert not stale_file.exists()
