import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..db import get_conn
from ..services.paths import resolve_paths
from ..services.loaders import find_session_file
from ..services.parsers import parse_session_detail

router = APIRouter()

SUMMARY_PROMPT = """다음 Claude Code 세션의 대화 내용을 분석하여 한글로 요약해주세요.

규칙:
- 2~3문장으로 작성 (100~200자)
- 첫 문장: 이 세션에서 수행한 핵심 작업
- 나머지: 주요 변경사항이나 결과
- 마크다운 없이 평문으로

수정된 파일: {files}
사용된 도구: {tools}

대화 내용:
{conversation}"""


def _build_conversation(detail: dict) -> tuple[str, list[str], list[str]]:
    """세션 상세에서 요약용 텍스트, 파일 목록, 도구 목록 추출"""
    lines = []
    for msg in detail["messages"][:60]:
        role = msg["role"]
        parts = []
        for block in msg.get("content", []):
            btype = block.get("type")
            if btype == "tool_result":
                continue
            if btype == "text" and block.get("text"):
                text = block["text"].strip()
                # tool result 성격의 텍스트 건너뛰기 (파일 내용, 에러 등)
                if text.startswith(("     1→", "<tool_use_error>", "File does not exist")):
                    continue
                parts.append(text[:300])
            elif btype == "tool_use":
                name = block.get("name", "")
                summary = block.get("input_summary", "")
                parts.append(f"[{name}: {summary}]" if summary else f"[{name}]")
        if parts:
            lines.append(f"{role}: {' | '.join(parts)}")
    return (
        "\n".join(lines)[:6000],
        detail.get("filesModified", []),
        list(detail.get("toolCalls", {}).keys()),
    )


@router.get("/api/session/{session_id}/summary")
def api_session_summary(session_id: str, user: Optional[str] = Query(None)):
    """캐시된 요약 반환. 없으면 404."""
    try:
        with get_conn() as cursor:
            cursor.execute(
                "SELECT summary FROM session_summaries WHERE session_id = %s",
                (session_id,),
            )
            row = cursor.fetchone()
            if row:
                return {"summary": row["summary"]}
    except Exception:
        pass
    raise HTTPException(status_code=404, detail="No summary cached")


@router.get("/api/session/{session_id}/summary/stream")
def api_session_summary_stream(
    session_id: str,
    user: Optional[str] = Query(None),
    regenerate: bool = Query(False),
):
    """SSE 스트리밍으로 요약 생성"""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    paths = resolve_paths(user)
    fp = find_session_file(session_id, paths["projects_dir"])
    if fp is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    detail = parse_session_detail(fp)
    if detail is None:
        raise HTTPException(status_code=500, detail="Failed to parse session")

    conversation_text, files_modified, tools_used = _build_conversation(detail)

    prompt = SUMMARY_PROMPT.format(
        files=", ".join(files_modified[:10]) or "없음",
        tools=", ".join(tools_used[:10]) or "없음",
        conversation=conversation_text,
    )

    def generate():
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        full_text = ""

        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            for text in stream.text_stream:
                full_text += text
                yield f"data: {json.dumps({'text': text})}\n\n"

        summary = full_text.strip()

        # DB에 저장
        try:
            with get_conn() as cursor:
                cursor.execute(
                    "INSERT INTO session_summaries (session_id, username, summary) VALUES (%s, %s, %s) "
                    "ON DUPLICATE KEY UPDATE summary = VALUES(summary)",
                    (session_id, user or "", summary),
                )
        except Exception:
            pass

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
