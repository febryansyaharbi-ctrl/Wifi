import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from database import db
from security import get_current_user, require_roles, SUPER_ADMIN, audit_log

router = APIRouter(prefix="/api/billing", tags=["billing"])

VALID_STATUSES = {"NOT_CONFIGURED", "TRIAL", "ACTIVE", "EXPIRED", "LOCKED"}


class PlanBody(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    price: float = Field(ge=0)
    duration_days: int = Field(ge=1, le=3650)
    description: Optional[str] = Field(default="", max_length=1000)
    active: bool = True
    display_order: int = 0


@router.get("/plans")
async def list_plans(user: dict = Depends(require_roles(SUPER_ADMIN))):
    return await db.subscription_plans.find({}, {"_id": 0}).sort("display_order", 1).to_list(500)


@router.post("/plans")
async def create_plan(body: PlanBody, user: dict = Depends(require_roles(SUPER_ADMIN))):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        **body.model_dump(),
        "created_at": now,
        "updated_at": now,
    }
    await db.subscription_plans.insert_one(doc)
    await audit_log(user["tenant_id"], user["id"], "SUBSCRIPTION_PLAN_CREATE", {"plan_id": doc["id"], "name": body.name})
    doc.pop("_id", None)
    return doc


@router.put("/plans/{plan_id}")
async def update_plan(plan_id: str, body: PlanBody, user: dict = Depends(require_roles(SUPER_ADMIN))):
    existing = await db.subscription_plans.find_one({"id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paket subscription tidak ditemukan")
    updates = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.subscription_plans.update_one({"id": plan_id}, {"$set": updates})
    await audit_log(user["tenant_id"], user["id"], "SUBSCRIPTION_PLAN_UPDATE", {"plan_id": plan_id})
    return await db.subscription_plans.find_one({"id": plan_id}, {"_id": 0})


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, user: dict = Depends(require_roles(SUPER_ADMIN))):
    existing = await db.subscription_plans.find_one({"id": plan_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paket subscription tidak ditemukan")
    used = await db.subscriptions.count_documents({"plan_id": plan_id})
    if used:
        raise HTTPException(status_code=409, detail="Paket masih digunakan oleh tenant")
    await db.subscription_plans.delete_one({"id": plan_id})
    await audit_log(user["tenant_id"], user["id"], "SUBSCRIPTION_PLAN_DELETE", {"plan_id": plan_id})
    return {"ok": True}


def public_subscription(doc: dict | None):
    if not doc:
        return None
    return {
        "id": doc.get("id"),
        "tenant_id": doc.get("tenant_id"),
        "plan_id": doc.get("plan_id"),
        "plan_name": doc.get("plan_name"),
        "status": doc.get("status"),
        "started_at": doc.get("started_at"),
        "expires_at": doc.get("expires_at"),
        "notes": doc.get("notes"),
        "updated_at": doc.get("updated_at"),
    }


class SubscriptionUpdate(BaseModel):
    plan_id: Optional[str] = Field(default=None, max_length=100)
    plan_name: Optional[str] = Field(default=None, max_length=100)
    status: str
    started_at: Optional[str] = None
    expires_at: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=1000)


async def ensure_subscription(tenant_id: str):
    existing = await db.subscriptions.find_one({"tenant_id": tenant_id})
    if existing:
        return existing

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "plan_id": None,
        "plan_name": None,
        "status": "NOT_CONFIGURED",
        "started_at": None,
        "expires_at": None,
        "notes": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.subscriptions.insert_one(doc)
    return doc


@router.get("/me")
async def billing_me(user: dict = Depends(get_current_user)):
    doc = await ensure_subscription(user["tenant_id"])
    return public_subscription(doc)


@router.get("/subscriptions")
async def list_subscriptions(user: dict = Depends(require_roles(SUPER_ADMIN))):
    docs = await db.subscriptions.find({}, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return [public_subscription(doc) for doc in docs]


@router.put("/subscriptions/{tenant_id}")
async def update_subscription(
    tenant_id: str,
    body: SubscriptionUpdate,
    user: dict = Depends(require_roles(SUPER_ADMIN)),
):
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant tidak ditemukan")

    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Status subscription tidak valid")

    existing = await db.subscriptions.find_one({"tenant_id": tenant_id})
    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "plan_id": body.plan_id,
        "plan_name": body.plan_name,
        "status": body.status,
        "started_at": body.started_at,
        "expires_at": body.expires_at,
        "notes": body.notes,
        "updated_at": now,
    }

    if existing:
        await db.subscriptions.update_one({"tenant_id": tenant_id}, {"$set": updates})
    else:
        updates.update({
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "created_at": now,
        })
        await db.subscriptions.insert_one(updates)

    await audit_log(
        user["tenant_id"],
        user["id"],
        "SUBSCRIPTION_UPDATE",
        {"tenant_id": tenant_id, "status": body.status, "plan_id": body.plan_id},
    )

    doc = await db.subscriptions.find_one({"tenant_id": tenant_id}, {"_id": 0})
    return public_subscription(doc)
