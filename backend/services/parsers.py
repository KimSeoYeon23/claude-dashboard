import json
from datetime import datetime
from pathlib import Path


def summarize_tool_input(tool_name, tool_input):
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


def parse_session_detail(fp: Path):
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
                display_parts.append({"type": "text", "text": content[:10000]})
            elif isinstance(content, list):
                for block in content:
                    btype = block.get("type")
                    if btype == "text":
                        display_parts.append({
                            "type": "text",
                            "text": block.get("text", "")[:10000],
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
                            "input_summary": summarize_tool_input(tool_name, tool_input),
                        })
                    elif btype == "tool_result":
                        result_content = block.get("content", "")
                        if isinstance(result_content, list):
                            texts = [r.get("text", "")[:5000] for r in result_content if r.get("type") == "text"]
                            result_text = "\n".join(texts)[:5000]
                        elif isinstance(result_content, str):
                            result_text = result_content[:5000]
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


def read_recent_activity(fp: Path, max_entries: int = 5):
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
                    summary = f"[{tool_name}] {summarize_tool_input(tool_name, tool_input)}"
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


def read_tool_usage(fp: Path) -> dict[str, int]:
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
