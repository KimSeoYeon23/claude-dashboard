import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def load_stats(fp: Path):
    with open(fp, encoding="utf-8") as f:
        return json.load(f)


def load_history(fp: Path):
    entries = []
    bad_lines = 0
    with open(fp, encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError as e:
                    bad_lines += 1
                    logger.warning(f"Invalid JSON at {fp}:{line_no}: {e}")
                    if bad_lines > 100:
                        raise RuntimeError(f"Too many parse errors in {fp}")
    if bad_lines > 0:
        logger.warning(f"Loaded {len(entries)} entries from {fp} ({bad_lines} errors)")
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
