import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import db
from security import normalize_phone

router = APIRouter(prefix="/api/registration", tags=["registration"])


class RegistrationBody(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    whatsapp: str = Field(min_length=8, max_length=25)
    plan_id: str = Field(min_length=1, max_length=100)


@router.get("/plans")
async def registration_plans():
    docs = await db.subscription_plans.find(
        {"active": True},
        {"_id": 0, "id": 1, "name": 1, "price": 1, "duration_days": 1, "description": 1},
    ).sort("display_order", 1).to_list(100)
    return docs


@router.post("")
async def create_registration(body: RegistrationBody):
    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Nama minimal 2 karakter")

    try:
        whatsapp = normalize_phone(body.whatsapp)
    except ValueError:
        raise HTTPException(status_code=400, detail="Nomor WhatsApp tidak valid")

    plan = await db.subscription_plans.find_one(
        {"id": body.plan_id, "active": True},
        {"_id": 0, "id": 1, "name": 1, "price": 1, "duration_days": 1},
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Paket subscription tidak ditemukan atau sudah tidak aktif")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "whatsapp": whatsapp,
        "plan_id": plan["id"],
        "plan_name": plan["name"],
        "amount": plan["price"],
        "duration_days": plan["duration_days"],
        "status": "PENDING_PAYMENT",
        "created_at": now,
        "updated_at": now,
    }
    await db.subadmin_applications.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/payment-info/{registration_id}")
async def payment_info(registration_id: str):
    application = await db.subadmin_applications.find_one(
        {"id": registration_id},
        {"_id": 0, "id": 1, "name": 1, "whatsapp": 1, "plan_name": 1, "amount": 1, "status": 1},
    )
    if not application:
        raise HTTPException(status_code=404, detail="Nomor pendaftaran tidak ditemukan")
    if application.get("status") not in {"PENDING_PAYMENT", "PAYMENT_REPORTED"}:
        raise HTTPException(status_code=400, detail="Pendaftaran ini tidak berada pada tahap pembayaran")
    settings = await db.system_settings.find_one({"key": "payment_settings"}, {"_id": 0})
    value = (settings or {}).get("value") or {}
    return {
        **application,
        "payment": {
            "whatsapp": value.get("whatsapp", ""),
            "bank_accounts": value.get("bank_accounts", []),
            "ewallets": value.get("ewallets", []),
            "qris_image": value.get("qris_image"),
        },
    }


@router.post("/{registration_id}/confirm-payment")
async def confirm_payment(registration_id: str):
    application = await db.subadmin_applications.find_one({"id": registration_id})
    if not application:
        raise HTTPException(status_code=404, detail="Nomor pendaftaran tidak ditemukan")
    if application.get("status") != "PENDING_PAYMENT":
        raise HTTPException(status_code=400, detail="Konfirmasi pembayaran sudah diproses atau tidak valid")
    now = datetime.now(timezone.utc).isoformat()
    result = await db.subadmin_applications.update_one(
        {"id": registration_id, "status": "PENDING_PAYMENT"},
        {"$set": {"status": "PAYMENT_REPORTED", "payment_reported_at": now, "updated_at": now}},
    )
    if result.modified_count != 1:
        raise HTTPException(status_code=409, detail="Status pendaftaran berubah. Silakan muat ulang halaman.")
    return {"status": "PAYMENT_REPORTED", "payment_reported_at": now}
