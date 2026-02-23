from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..services.paths import claude_dir
from ..services.loaders import find_session_file
from ..services.parsers import read_recent_activity, read_tool_usage
from ..services.agents import get_active_agents

router = APIRouter()


@router.get("/api/agents")
def api_agents():
    agents = get_active_agents()
    return {"agents": agents, "count": len(agents)}


@router.get("/api/agent/{pid}")
def api_agent_detail(pid: int):
    """단일 에이전트 상세 정보 (최근 활동 더 많이 포함)"""
    agents = get_active_agents()
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
