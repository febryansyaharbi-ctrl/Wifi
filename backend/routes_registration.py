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
