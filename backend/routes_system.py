import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from database import db
from security import require_roles, SUPER_ADMIN

router = APIRouter(prefix="/api/system", tags=["system"])

DEFAULT_LOGIN_PROMO = "Jadilah Sub-Admin WiFi dan kembangkan layanan internet Anda. Dapatkan dashboard mandiri, branding WiFi sendiri, coverage GIS, leads terisolasi, dan billing mulai dari {PRICE_START}/bulan."


class LoginPromoBody(BaseModel):
    text: str = Field(min_length=20, max_length=500)


@router.get("/login-promo")
async def get_login_promo():
    doc = await db.system_settings.find_one({"key": "login_promo"}, {"_id": 0})
    text = (doc or {}).get("value") or DEFAULT_LOGIN_PROMO
    plan = await db.subscription_plans.find_one({"active": True}, {"_id": 0, "price": 1}, sort=[("price", 1)])
    price = f"Rp {int(plan.get("price", 0)):,}".replace(",", ".") if plan else "harga paket aktif"
    return {"text": text.replace("{PRICE_START}", price), "price_start": price}


@router.put("/login-promo")
async def update_login_promo(body: LoginPromoBody, user: dict = Depends(require_roles(SUPER_ADMIN))):
    now = datetime.now(timezone.utc).isoformat()
    await db.system_settings.update_one(
        {"key": "login_promo"},
        {"$set": {"key": "login_promo", "value": body.text.strip(), "updated_at": now, "updated_by": user["id"]}},
        upsert=True,
    )
    return {"text": body.text.strip()}
