from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from ..config import DATA_DIR
from ..services.paths import claude_dir
from ..services.loaders import find_session_file
from ..services.parsers import read_recent_activity, read_tool_usage
from ..services.agents import get_active_agents
from ..services.auth import resolve_api_user

router = APIRouter()


@router.get("/api/agents")
def api_agents(authorization: str | None = Header(None)):
    resolved_user = resolve_api_user(None, authorization)
    agents = get_active_agents()
    if DATA_DIR and resolved_user:
        agents = [a for a in agents if a.get("owner") == resolved_user]
    return {"agents": agents, "count": len(agents)}


@router.get("/api/agent/{pid}")
def api_agent_detail(pid: int, authorization: str | None = Header(None)):
    """단일 에이전트 상세 정보 (최근 활동 더 많이 포함)"""
    resolved_user = resolve_api_user(None, authorization)
    agents = get_active_agents()
    if DATA_DIR and resolved_user:
        agents = [a for a in agents if a.get("owner") == resolved_user]
    agent = next((a for a in agents if a["pid"] == pid), None)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent PID {pid} not found")

    # 최근 활동을 더 많이 가져오기 (20개)
    if agent.get("sessionId"):
        owner = agent.get("owner") or None
        projects_dir = claude_dir(owner) / "projects" if owner else Path.home() / ".claude" / "projects"
        fp = find_session_file(agent["sessionId"], projects_dir)
        if fp:
            agent["recentActivity"] = read_recent_activity(fp, max_entries=20)
            agent["toolUsage"] = read_tool_usage(fp)

    return agent
