import json
import subprocess
from pathlib import Path

from .paths import claude_dir
from .parsers import read_recent_activity


def get_active_agents():
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
            user_projects_dir = claude_dir(owner or None) / "projects" if owner else Path.home() / ".claude" / "projects"
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
            recent_activity = read_recent_activity(session_fp) if session_fp else []

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
