import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import db
from security import require_roles, SUPER_ADMIN

router = APIRouter(prefix="/api/system", tags=["system"])

DEFAULT_LOGIN_PROMO = "Jadilah Sub-Admin WiFi dan kembangkan layanan internet Anda. Nikmati dashboard mandiri, landing page berbranding sendiri, data leads terisolasi, coverage GIS, dan paket billing mulai dari harga terjangkau."


class LoginPromoBody(BaseModel):
    text: str = Field(min_length=20, max_length=500)


@router.get("/login-promo")
async def get_login_promo():
    doc = await db.system_settings.find_one({"key": "login_promo"}, {"_id": 0})
    return {"text": (doc or {}).get("value") or DEFAULT_LOGIN_PROMO}


@router.put("/login-promo")
async def update_login_promo(body: LoginPromoBody, user: dict = Depends(require_roles(SUPER_ADMIN))):
    now = datetime.now(timezone.utc).isoformat()
    await db.system_settings.update_one(
        {"key": "login_promo"},
        {"$set": {"key": "login_promo", "value": body.text.strip(), "updated_at": now, "updated_by": user["id"]}},
        upsert=True,
    )
    return {"text": body.text.strip()}
