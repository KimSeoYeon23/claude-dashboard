#!/usr/bin/env python3
"""Claude Code Session Dashboard — FastAPI Backend (Multi-user)"""

import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

PORT = 8420
STATIC_DIR = Path(__file__).parent / "static"

app = FastAPI(title="Claude Code Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 유저별 경로 해석 ──────────────────────────────────
def _claude_dir(user: Optional[str] = None) -> Path:
    """유저별 .claude 디렉토리 경로 반환"""
    if user:
        return Path(f"/Users/{user}/.claude")
    return Path.home() / ".claude"


def _resolve_paths(user: Optional[str] = None):
    """유저별 주요 경로들 반환"""
    base = _claude_dir(user)
    return {
        "claude_dir": base,
        "stats_file": base / "stats-cache.json",
        "history_file": base / "history.jsonl",
        "projects_dir": base / "projects",
    }


# ── 캐시 ──────────────────────────────────────────────
_cache: dict = {}


def _cached(key: str, filepath: Path, loader):
    """mtime 기반 캐시: 파일이 변경된 경우에만 재파싱"""
    if not filepath.exists():
        return None
    mtime = filepath.stat().st_mtime
    if key in _cache and _cache[key]["mtime"] == mtime:
        return _cache[key]["data"]
    data = loader(filepath)
    _cache[key] = {"mtime": mtime, "data": data}
    return data


# ── 데이터 로더 ───────────────────────────────────────
def _load_stats(fp: Path):
    with open(fp, encoding="utf-8") as f:
        return json.load(f)


def _load_history(fp: Path):
    entries = []
    with open(fp, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return entries


def _discover_projects(projects_dir: Path):
    projects = {}
    if not projects_dir.exists():
        return projects
    for d in projects_dir.iterdir():
        if d.is_dir():
            name = d.name
            session_count = len(list(d.glob("*.jsonl")))
            if session_count > 0:
                projects[name] = {
                    "name": name,
                    "path": str(d),
                    "sessionCount": session_count,
                }
    return projects


def _find_session_file(session_id: str, projects_dir: Path):
    for jsonl in projects_dir.rglob(f"{session_id}.jsonl"):
        if "subagents" not in str(jsonl):
            return jsonl
    return None


def _parse_session_detail(fp: Path):
    messages = []
    tool_calls = {}
    files_modified: set[str] = set()
    total_input_tokens = 0
    total_output_tokens = 0
    model = ""
    start_ts = None
    end_ts = None
    subagent_ids = []

    with open(fp, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            entry_type = entry.get("type")
            ts = entry.get("timestamp")

            if ts:
                if start_ts is None:
                    start_ts = ts
                end_ts = ts

            if entry_type not in ("user", "assistant", "system"):
                continue

            msg = entry.get("message", {})
            role = msg.get("role", entry_type)
            if msg.get("model"):
                model = msg["model"]

            usage = msg.get("usage", {})
            total_input_tokens += usage.get("input_tokens", 0)
            total_output_tokens += usage.get("output_tokens", 0)

            content = msg.get("content", "")
            display_parts = []

            if isinstance(content, str):
                display_parts.append({"type": "text", "text": content[:500]})
            elif isinstance(content, list):
                for block in content:
                    btype = block.get("type")
                    if btype == "text":
                        display_parts.append({
                            "type": "text",
                            "text": block.get("text", "")[:500],
                        })
                    elif btype == "thinking":
                        display_parts.append({"type": "thinking", "text": "(thinking...)"})
                    elif btype == "tool_use":
                        tool_name = block.get("name", "unknown")
                        tool_calls[tool_name] = tool_calls.get(tool_name, 0) + 1
                        tool_input = block.get("input", {})
                        for key in ("file_path", "path", "filepath"):
                            if key in tool_input:
                                val = tool_input[key]
                                if isinstance(val, str) and val:
                                    files_modified.add(val)
                        display_parts.append({
                            "type": "tool_use",
                            "name": tool_name,
                            "input_summary": _summarize_tool_input(tool_name, tool_input),
                        })
                    elif btype == "tool_result":
                        result_content = block.get("content", "")
                        if isinstance(result_content, list):
                            texts = [r.get("text", "")[:200] for r in result_content if r.get("type") == "text"]
                            result_text = "\n".join(texts)[:300]
                        elif isinstance(result_content, str):
                            result_text = result_content[:300]
                        else:
                            result_text = ""
                        display_parts.append({
                            "type": "tool_result",
                            "tool_use_id": block.get("tool_use_id", ""),
                            "text": result_text,
                            "is_error": block.get("is_error", False),
                        })

            messages.append({
                "role": role,
                "timestamp": ts,
                "content": display_parts,
            })

    # 서브에이전트 탐색
    session_dir = fp.parent / fp.stem
    if session_dir.is_dir():
        subagents_dir = session_dir / "subagents"
        if subagents_dir.is_dir():
            for sa_file in subagents_dir.glob("*.jsonl"):
                subagent_ids.append(sa_file.stem)

    duration_ms = 0
    if start_ts and end_ts:
        try:
            if isinstance(start_ts, (int, float)) and isinstance(end_ts, (int, float)):
                duration_ms = end_ts - start_ts
            elif isinstance(start_ts, str) and isinstance(end_ts, str):
                t0 = datetime.fromisoformat(start_ts.replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(end_ts.replace("Z", "+00:00"))
                duration_ms = (t1 - t0).total_seconds() * 1000
        except Exception:
            duration_ms = 0

    return {
        "sessionId": fp.stem,
        "model": model,
        "messageCount": len(messages),
        "totalInputTokens": total_input_tokens,
        "totalOutputTokens": total_output_tokens,
        "toolCalls": tool_calls,
        "filesModified": sorted(files_modified),
        "durationMs": duration_ms,
        "startTimestamp": start_ts,
        "endTimestamp": end_ts,
        "messages": messages,
        "subagentIds": subagent_ids,
    }


def _summarize_tool_input(tool_name, tool_input):
    if not isinstance(tool_input, dict):
        return ""
    if tool_name in ("Read", "read"):
        return tool_input.get("file_path", "")
    if tool_name in ("Edit", "edit"):
        return tool_input.get("file_path", "")
    if tool_name in ("Write", "write"):
        return tool_input.get("file_path", "")
    if tool_name in ("Bash", "bash"):
        return tool_input.get("command", "")[:120]
    if tool_name in ("Glob", "glob"):
        return tool_input.get("pattern", "")
    if tool_name in ("Grep", "grep"):
        return f'{tool_input.get("pattern", "")} in {tool_input.get("path", "")}'
    if tool_name in ("Task", "task"):
        return tool_input.get("description", "")[:100]
    keys = list(tool_input.keys())[:3]
    parts = []
    for k in keys:
        v = tool_input[k]
        if isinstance(v, str):
            parts.append(f"{k}={v[:60]}")
        else:
            parts.append(k)
    return ", ".join(parts)


def _read_recent_activity(fp: Path, max_entries: int = 5):
    """세션 JSONL 파일의 마지막 N개 항목에서 최근 활동 추출"""
    if not fp or not fp.exists():
        return []

    # 파일 끝에서부터 읽기 (효율적)
    lines = []
    try:
        with open(fp, "rb") as f:
            f.seek(0, 2)
            file_size = f.tell()
            # 마지막 64KB만 읽기 (충분)
            read_size = min(file_size, 65536)
            f.seek(file_size - read_size)
            chunk = f.read().decode("utf-8", errors="ignore")
            lines = [l for l in chunk.strip().split("\n") if l.strip()]
    except Exception:
        return []

    activities = []
    for raw_line in reversed(lines):
        if len(activities) >= max_entries:
            break
        try:
            entry = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        entry_type = entry.get("type")
        if entry_type not in ("user", "assistant", "system"):
            continue

        msg = entry.get("message", {})
        role = msg.get("role", entry_type)
        ts = entry.get("timestamp")
        content = msg.get("content", "")

        summary = ""
        full_text = ""
        activity_type = "message"

        if isinstance(content, str):
            full_text = content[:2000]
            summary = content[:150]
        elif isinstance(content, list):
            for block in content:
                btype = block.get("type")
                if btype == "tool_use":
                    tool_name = block.get("name", "")
                    tool_input = block.get("input", {})
                    summary = f"[{tool_name}] {_summarize_tool_input(tool_name, tool_input)}"
                    full_text = summary
                    activity_type = "tool_call"
                    break
                elif btype == "text" and block.get("text"):
                    full_text = block["text"][:2000]
                    summary = block["text"][:150]
                    break

        if summary:
            activities.append({
                "role": role,
                "type": activity_type,
                "summary": summary,
                "fullText": full_text if full_text != summary else "",
                "timestamp": ts,
            })

    activities.reverse()
    return activities


def _read_tool_usage(fp: Path) -> dict[str, int]:
    """세션 JSONL 파일에서 도구 호출 횟수 집계"""
    if not fp or not fp.exists():
        return {}
    tool_calls: dict[str, int] = {}
    try:
        with open(fp, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if entry.get("type") != "assistant":
                    continue
                content = entry.get("message", {}).get("content", "")
                if not isinstance(content, list):
                    continue
                for block in content:
                    if block.get("type") == "tool_use":
                        name = block.get("name", "unknown")
                        tool_calls[name] = tool_calls.get(name, 0) + 1
    except Exception:
        pass
    return tool_calls


def _get_active_agents():
    agents = []
    try:
        result = subprocess.run(
            ["pgrep", "-x", "claude"],
            capture_output=True, text=True, timeout=5,
        )
        pids = [p.strip() for p in result.stdout.strip().split("\n") if p.strip()]
        if not pids:
            return agents

        for pid in pids:
            tty = ""
            cpu = "0"
            mem = "0"
            started = ""
            try:
                ps_res = subprocess.run(
                    ["ps", "-p", pid, "-o", "tty=,pcpu=,pmem="],
                    capture_output=True, text=True, timeout=5,
                )
                ps_parts = ps_res.stdout.strip().split()
                if len(ps_parts) >= 3:
                    tty = ps_parts[0]
                    cpu = ps_parts[1]
                    mem = ps_parts[2]

                ps_lstart = subprocess.run(
                    ["ps", "-p", pid, "-o", "lstart="],
                    capture_output=True, text=True, timeout=5,
                )
                started = ps_lstart.stdout.strip()
            except Exception:
                pass

            # CWD + 유저 추출
            cwd = ""
            owner = ""
            try:
                lsof_res = subprocess.run(
                    ["lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"],
                    capture_output=True, text=True, timeout=5,
                )
                for lsof_line in lsof_res.stdout.split("\n"):
                    if lsof_line.startswith("n/"):
                        cwd = lsof_line[1:]
                        break
            except Exception:
                pass

            # ps로 유저명 추출
            try:
                ps_user = subprocess.run(
                    ["ps", "-p", pid, "-o", "user="],
                    capture_output=True, text=True, timeout=5,
                )
                owner = ps_user.stdout.strip()
            except Exception:
                pass

            # 유저의 .claude 디렉토리 기반으로 프로젝트/세션 탐색
            user_projects_dir = _claude_dir(owner or None) / "projects" if owner else Path.home() / ".claude" / "projects"
            proj_dir_name = cwd.replace("/", "-") if cwd else ""
            proj_dir = user_projects_dir / proj_dir_name if proj_dir_name else None
            likely_session = None
            session_fp = None
            if proj_dir and proj_dir.exists():
                jsonl_files = sorted(
                    proj_dir.glob("*.jsonl"),
                    key=lambda f: f.stat().st_mtime,
                    reverse=True,
                )
                if jsonl_files:
                    likely_session = jsonl_files[0].stem
                    session_fp = jsonl_files[0]

            first_message = ""
            model = ""
            if likely_session and session_fp:
                try:
                    with open(session_fp, encoding="utf-8") as f:
                        for raw_line in f:
                            raw_line = raw_line.strip()
                            if not raw_line:
                                continue
                            entry = json.loads(raw_line)
                            if entry.get("type") == "assistant" and not model:
                                m = entry.get("message", {}).get("model", "")
                                if m:
                                    model = m
                            if entry.get("type") == "user" and not first_message:
                                msg = entry.get("message", {})
                                content = msg.get("content", "")
                                if isinstance(content, str):
                                    first_message = content[:100]
                                elif isinstance(content, list):
                                    for b in content:
                                        if b.get("type") == "text":
                                            first_message = b.get("text", "")[:100]
                                            break
                            if first_message and model:
                                break
                except Exception:
                    pass

            # 최근 활동 읽기
            recent_activity = _read_recent_activity(session_fp) if session_fp else []

            agents.append({
                "pid": int(pid),
                "tty": tty,
                "cwd": cwd,
                "owner": owner,
                "project": proj_dir_name if (proj_dir and proj_dir.exists()) else "",
                "sessionId": likely_session,
                "firstMessage": first_message,
                "model": model,
                "cpu": cpu,
                "mem": mem,
                "started": started,
                "recentActivity": recent_activity,
            })
    except Exception:
        pass

    return agents


# ── 유저 목록 ─────────────────────────────────────────
def _discover_users():
    """시스템에서 .claude 디렉토리가 있는 유저 목록 반환"""
    users = []
    users_dir = Path("/Users")
    if not users_dir.exists():
        return users
    for d in users_dir.iterdir():
        if d.is_dir() and (d / ".claude").is_dir():
            claude_dir = d / ".claude"
            stats_exists = (claude_dir / "stats-cache.json").exists()
            history_exists = (claude_dir / "history.jsonl").exists()
            if stats_exists or history_exists:
                users.append({
                    "username": d.name,
                    "hasStats": stats_exists,
                    "hasHistory": history_exists,
                })
    return users


# ── API 엔드포인트 ────────────────────────────────────

@app.get("/api/users")
def api_users():
    users = _discover_users()
    return {"users": users}


@app.get("/api/stats")
def api_stats(user: Optional[str] = Query(None)):
    paths = _resolve_paths(user)
    data = _cached(f"stats:{user or 'me'}", paths["stats_file"], _load_stats)
    if data is None:
        raise HTTPException(status_code=404, detail="stats-cache.json not found")
    return data


@app.get("/api/projects")
def api_projects(user: Optional[str] = Query(None)):
    paths = _resolve_paths(user)
    projects = _discover_projects(paths["projects_dir"])
    return {"projects": list(projects.values())}


@app.get("/api/sessions")
def api_sessions(
    user: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1),
    limit: int = Query(30),
):
    paths = _resolve_paths(user)
    history = _cached(f"history:{user or 'me'}", paths["history_file"], _load_history)
    if history is None:
        raise HTTPException(status_code=404, detail="history.jsonl not found")

    limit = min(limit, 100)
    filtered = list(reversed(history))

    if project:
        # project 디렉토리명(-로 구분)을 원래 경로(/로 구분)로 변환하여 매칭
        project_as_path = project.lstrip("-").replace("-", "/")
        filtered = [
            e for e in filtered
            if project in e.get("project", "")
            or project_as_path in e.get("project", "")
        ]

    if search:
        search_lower = search.lower()
        filtered = [
            e for e in filtered
            if search_lower in e.get("display", "").lower()
            or search_lower in e.get("sessionId", "").lower()
        ]

    total = len(filtered)
    start = (page - 1) * limit
    page_items = filtered[start: start + limit]

    return {
        "sessions": page_items,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": (total + limit - 1) // limit if total > 0 else 0,
    }


@app.get("/api/agents")
def api_agents():
    agents = _get_active_agents()
    return {"agents": agents, "count": len(agents)}


@app.get("/api/agent/{pid}")
def api_agent_detail(pid: int):
    """단일 에이전트 상세 정보 (최근 활동 더 많이 포함)"""
    agents = _get_active_agents()
    agent = next((a for a in agents if a["pid"] == pid), None)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent PID {pid} not found")

    # 최근 활동을 더 많이 가져오기 (20개)
    if agent.get("sessionId"):
        owner = agent.get("owner") or None
        projects_dir = _claude_dir(owner) / "projects" if owner else Path.home() / ".claude" / "projects"
        fp = _find_session_file(agent["sessionId"], projects_dir)
        if fp:
            agent["recentActivity"] = _read_recent_activity(fp, max_entries=20)
            agent["toolUsage"] = _read_tool_usage(fp)

    return agent


@app.get("/api/session/{session_id}")
def api_session_detail(session_id: str, user: Optional[str] = Query(None)):
    paths = _resolve_paths(user)
    fp = _find_session_file(session_id, paths["projects_dir"])
    if fp is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    cache_key = f"session:{user or 'me'}:{session_id}"
    detail = _cached(cache_key, fp, _parse_session_detail)
    if detail is None:
        raise HTTPException(status_code=500, detail="Failed to parse session")
    return detail


# ── 정적 파일 서빙 (빌드 결과) ─────────────────────────
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


def main():
    print(f"🚀 Claude Code Dashboard running at http://localhost:{PORT}")
    print(f"   Press Ctrl+C to stop")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
