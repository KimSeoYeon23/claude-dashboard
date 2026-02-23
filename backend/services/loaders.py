import json
from pathlib import Path


def load_stats(fp: Path):
    with open(fp, encoding="utf-8") as f:
        return json.load(f)


def load_history(fp: Path):
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


def discover_projects(projects_dir: Path):
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


def find_session_file(session_id: str, projects_dir: Path):
    for jsonl in projects_dir.rglob(f"{session_id}.jsonl"):
        if "subagents" not in str(jsonl):
            return jsonl
    return None
