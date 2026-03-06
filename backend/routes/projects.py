from typing import Optional

from fastapi import APIRouter, Header, Query

from ..services.paths import resolve_paths
from ..services.loaders import discover_projects
from ..services.auth import resolve_api_user

router = APIRouter()


@router.get("/api/projects")
def api_projects(
    user: Optional[str] = Query(None),
    authorization: str | None = Header(None),
):
    resolved_user = resolve_api_user(user, authorization)
    paths = resolve_paths(resolved_user)
    projects = discover_projects(paths["projects_dir"])
    return {"projects": list(projects.values())}
