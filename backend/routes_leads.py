import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Depends, HTTPException
from pydantic import BaseModel

from database import db
from security import resolve_tenant, get_current_user, normalize_phone

router = APIRouter(prefix="/api/leads", tags=["leads"])


class LeadCreate(BaseModel):
    name: str
    phone: str
    subdomain: Optional[str] = None


@router.post("")
async def create_lead(body: LeadCreate, request: Request):
    tenant = await resolve_tenant(request, body.subdomain)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama wajib diisi.")
    try:
        phone = normalize_phone(body.phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Masukkan nomor WhatsApp/telepon yang valid.")
    now = datetime.now(timezone.utc).isoformat()
    lead = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant["id"],
        "name": name,
        "phone": phone,
        "latitude": None,
        "longitude": None,
        "coverage_status": "NOT_CHECKED",
        "coverage_distance": None,
        "city": None,
        "matched_coverage_area": None,
        "checked_at": None,
        "created_at": now,
    }
    await db.leads.insert_one(lead)
    lead.pop("_id", None)
    return lead


@router.get("")
async def list_leads(user: dict = Depends(get_current_user),
                     page: int = 1, limit: int = 20, search: str = None,
                     status: str = None, date_from: str = None, date_to: str = None):
    query = {"tenant_id": user["tenant_id"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if status and status != "ALL":
        query["coverage_status"] = status
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        query["created_at"] = rng
    page = max(1, page)
    limit = min(max(1, limit), 100)
    total = await db.leads.count_documents(query)
    docs = await db.leads.find(query, {"_id": 0}).sort("created_at", -1) \
        .skip((page - 1) * limit).limit(limit).to_list(limit)
    return {"total": total, "page": page, "limit": limit, "leads": docs}
