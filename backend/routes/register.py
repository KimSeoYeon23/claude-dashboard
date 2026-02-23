from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..services.auth import register_user, get_user_info

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    email: str = ""


@router.post("/api/register")
def api_register(body: RegisterRequest):
    if not body.username or len(body.username) < 2:
        raise HTTPException(status_code=400, detail="유저명은 2자 이상이어야 합니다")

    result = register_user(body.username, body.email)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])

    return result


@router.get("/api/me")
def api_me(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[7:]
    info = get_user_info(token)
    if not info:
        raise HTTPException(status_code=401, detail="Invalid token")
    return info
