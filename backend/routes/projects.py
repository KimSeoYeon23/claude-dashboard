from typing import Optional

from fastapi import APIRouter, Query

from ..services.paths import resolve_paths
from ..services.loaders import discover_projects

router = APIRouter()


@router.get("/api/projects")
def api_projects(user: Optional[str] = Query(None)):
    paths = resolve_paths(user)
    projects = discover_projects(paths["projects_dir"])
    return {"projects": list(projects.values())}
