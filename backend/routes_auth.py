import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel

from database import db
from security import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    set_auth_cookies, clear_auth_cookies, get_current_user, audit_log,
    check_lockout, register_failed, clear_attempts,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginReq(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(req: LoginReq, request: Request, response: Response):
    email = req.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await check_lockout(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        await register_failed(identifier)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    await clear_attempts(identifier)
    access = create_access_token(user["id"], user["email"], user["role"], user["tenant_id"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    await audit_log(user["tenant_id"], user["id"], "LOGIN")
    return {
        "id": user["id"], "email": user["email"], "name": user.get("name"),
        "role": user["role"], "tenant_id": user["tenant_id"],
    }


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    await audit_log(user["tenant_id"], user["id"], "LOGOUT")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
