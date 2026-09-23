import json
import os
import secrets
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from database import db
from security import require_active_subscription, audit_log

try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:
    Fernet = None
    InvalidToken = Exception

router = APIRouter(prefix="/api/ads", tags=["ads"])

META_VERSION = os.environ.get("META_GRAPH_VERSION", "v24.0")
META_GRAPH = f"https://graph.facebook.com/{META_VERSION}"
TIKTOK_BASE = "https://business-api.tiktok.com/open_api/v1.3"


def _now():
    return datetime.now(timezone.utc)


def _fernet():
    key = os.environ.get("ADS_TOKEN_ENCRYPTION_KEY", "").strip()
    if not key or Fernet is None:
        raise HTTPException(
            status_code=503,
            detail="Integrasi Ads belum dikonfigurasi. Isi ADS_TOKEN_ENCRYPTION_KEY di backend."
        )
    try:
        return Fernet(key.encode())
    except Exception:
        raise HTTPException(status_code=503, detail="ADS_TOKEN_ENCRYPTION_KEY tidak valid.")


def _encrypt(value):
    return _fernet().encrypt(value.encode()).decode()


def _decrypt(value):
    try:
        return _fernet().decrypt(value.encode()).decode()
    except Exception:
        raise HTTPException(status_code=503, detail="Token Ads tersimpan tidak dapat dibuka.")


def _http_json(url, method="GET", params=None, body=None, headers=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    data = None
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    if body is not None:
        data = json.dumps(body).encode()
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Platform Ads tidak dapat dihubungi: {exc}")


def _config(platform):
    if platform == "meta":
        return {
            "app_id": os.environ.get("META_APP_ID", "").strip(),
            "app_secret": os.environ.get("META_APP_SECRET", "").strip(),
            "redirect_uri": os.environ.get("META_REDIRECT_URI", "").strip(),
        }
    return {
        "app_id": os.environ.get("TIKTOK_CLIENT_KEY", "").strip(),
        "app_secret": os.environ.get("TIKTOK_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.environ.get("TIKTOK_REDIRECT_URI", "").strip(),
    }


def _require_config(platform):
    cfg = _config(platform)
    if not all(cfg.values()):
        raise HTTPException(
            status_code=503,
            detail=f"Integrasi {platform.title()} Ads belum dikonfigurasi di backend."
        )
    return cfg


def _safe_connection(doc):
    return {
        "id": doc["id"],
        "platform": doc["platform"],
        "accounts": doc.get("accounts", []),
        "selected_account_id": doc.get("selected_account_id"),
        "connected_at": doc.get("connected_at"),
        "updated_at": doc.get("updated_at"),
    }


class SelectAccount(BaseModel):
    account_id: str


@router.get("/connections")
async def list_connections(user: dict = Depends(require_active_subscription)):
    docs = await db.ad_connections.find(
        {"tenant_id": user["tenant_id"]}, {"_id": 0}
    ).to_list(20)
    return [_safe_connection(d) for d in docs]


@router.get("/connect/{platform}")
async def connect(platform: str, user: dict = Depends(require_active_subscription)):
    if platform not in {"meta", "tiktok"}:
        raise HTTPException(status_code=400, detail="Platform Ads tidak didukung.")
    cfg = _require_config(platform)
    state = secrets.token_urlsafe(32)
    await db.ad_oauth_states.insert_one({
        "state": state,
        "tenant_id": user["tenant_id"],
        "user_id": user["id"],
        "platform": platform,
        "created_at": _now().isoformat(),
        "expires_at": (_now() + timedelta(minutes=10)).isoformat(),
    })
    if platform == "meta":
        params = {
            "client_id": cfg["app_id"],
            "redirect_uri": cfg["redirect_uri"],
            "response_type": "code",
            "state": state,
            "scope": "ads_read,ads_management,business_management",
        }
        url = "https://www.facebook.com/" + META_VERSION + "/dialog/oauth?" + urllib.parse.urlencode(params)
    else:
        params = {
            "app_id": cfg["app_id"],
            "redirect_uri": cfg["redirect_uri"],
            "state": state,
        }
        url = "https://business-api.tiktok.com/portal/auth?" + urllib.parse.urlencode(params)
    return {"url": url}


@router.get("/callback/{platform}")
async def oauth_callback(platform: str, code: str | None = None, state: str | None = None, error: str | None = None):
    frontend = os.environ.get("FRONTEND_URL", "").rstrip("/")
    if error or not state:
        return RedirectResponse(f"{frontend}/admin/ads?ads_error=oauth_cancelled")
    if platform not in {"meta", "tiktok"}:
        return RedirectResponse(f"{frontend}/admin/ads?ads_error=invalid_platform")

    oauth = await db.ad_oauth_states.find_one_and_delete({"state": state})
    if not oauth or oauth.get("expires_at", "") < _now().isoformat():
        return RedirectResponse(f"{frontend}/admin/ads?ads_error=oauth_expired")
    if not code:
        return RedirectResponse(f"{frontend}/admin/ads?ads_error=missing_code")

    cfg = _require_config(platform)
    try:
        if platform == "meta":
            token = _http_json(
                f"{META_GRAPH}/oauth/access_token",
                params={
                    "client_id": cfg["app_id"],
                    "client_secret": cfg["app_secret"],
                    "redirect_uri": cfg["redirect_uri"],
                    "code": code,
                },
            )
            access_token = token.get("access_token")
            if not access_token:
                raise ValueError(token)
            me = _http_json(f"{META_GRAPH}/me", params={"fields": "id,name", "access_token": access_token})
            accounts = _http_json(
                f"{META_GRAPH}/me/adaccounts",
                params={
                    "fields": "id,name,account_status,currency,timezone_name",
                    "limit": 100,
                    "access_token": access_token,
                },
            ).get("data", [])
            account_list = [
                {
                    "id": a.get("id"),
                    "name": a.get("name") or a.get("id"),
                    "status": a.get("account_status"),
                    "currency": a.get("currency"),
                    "timezone": a.get("timezone_name"),
                }
                for a in accounts if a.get("id")
            ]
            profile = {"id": me.get("id"), "name": me.get("name")}
        else:
            token = _http_json(
                f"{TIKTOK_BASE}/oauth2/access_token/",
                method="POST",
                body={
                    "app_id": cfg["app_id"],
                    "secret": cfg["app_secret"],
                    "auth_code": code,
                },
            )
            data = token.get("data") or {}
            access_token = data.get("access_token")
            refresh_token = data.get("refresh_token")
            if not access_token:
                raise ValueError(token)
            advertisers = _http_json(
                f"{TIKTOK_BASE}/oauth2/advertiser/get/",
                params={
                    "app_id": cfg["app_id"],
                    "secret": cfg["app_secret"],
                    "access_token": access_token,
                },
            ).get("data", {}).get("list", [])
            account_list = [
                {
                    "id": str(a.get("advertiser_id")),
                    "name": a.get("advertiser_name") or str(a.get("advertiser_id")),
                    "status": a.get("status"),
                    "currency": a.get("currency"),
                }
                for a in advertisers if a.get("advertiser_id")
            ]
            profile = {"id": data.get("open_id"), "name": "TikTok Ads"}
        doc = {
            "id": str(uuid.uuid4()),
            "tenant_id": oauth["tenant_id"],
            "platform": platform,
            "access_token": _encrypt(access_token),
            "refresh_token": _encrypt(refresh_token) if platform == "tiktok" and refresh_token else None,
            "profile": profile,
            "accounts": account_list,
            "selected_account_id": account_list[0]["id"] if len(account_list) == 1 else None,
            "connected_at": _now().isoformat(),
            "updated_at": _now().isoformat(),
        }
        await db.ad_connections.update_one(
            {"tenant_id": oauth["tenant_id"], "platform": platform},
            {"$set": doc},
            upsert=True,
        )
        await audit_log(oauth["tenant_id"], oauth["user_id"], "ADS_CONNECTED", {"platform": platform})
        return RedirectResponse(f"{frontend}/admin/ads?ads_connected={platform}")
    except Exception:
        return RedirectResponse(f"{frontend}/admin/ads?ads_error=oauth_failed")


@router.post("/connections/{platform}/select")
async def select_account(platform: str, body: SelectAccount,
                         user: dict = Depends(require_active_subscription)):
    doc = await db.ad_connections.find_one({"tenant_id": user["tenant_id"], "platform": platform})
    if not doc:
        raise HTTPException(status_code=404, detail="Koneksi Ads belum ada.")
    if body.account_id not in {a.get("id") for a in doc.get("accounts", [])}:
        raise HTTPException(status_code=400, detail="Akun iklan tidak ditemukan pada koneksi ini.")
    await db.ad_connections.update_one(
        {"id": doc["id"]},
        {"$set": {"selected_account_id": body.account_id, "updated_at": _now().isoformat()}}
    )
    return {"ok": True, "selected_account_id": body.account_id}


@router.delete("/connections/{platform}")
async def disconnect(platform: str, user: dict = Depends(require_active_subscription)):
    doc = await db.ad_connections.find_one({"tenant_id": user["tenant_id"], "platform": platform})
    if doc:
        await db.ad_connections.delete_one({"id": doc["id"]})
        await audit_log(user["tenant_id"], user["id"], "ADS_DISCONNECTED", {"platform": platform})
    return {"ok": True}


@router.get("/campaigns/{platform}")
async def campaigns(platform: str, user: dict = Depends(require_active_subscription)):
    if platform not in {"meta", "tiktok"}:
        raise HTTPException(status_code=400, detail="Platform Ads tidak didukung.")
    doc = await db.ad_connections.find_one({"tenant_id": user["tenant_id"], "platform": platform})
    if not doc:
        raise HTTPException(status_code=404, detail=f"{platform.title()} Ads belum terhubung.")
    account_id = doc.get("selected_account_id")
    if not account_id:
        raise HTTPException(status_code=400, detail="Pilih akun iklan terlebih dahulu.")
    token = _decrypt(doc["access_token"])

    if platform == "meta":
        result = _http_json(
            f"{META_GRAPH}/{account_id}/campaigns",
            params={
                "fields": "id,name,status,effective_status,objective,start_time,stop_time",
                "limit": 100,
                "access_token": token,
            },
        )
        data = result.get("data", [])
    else:
        result = _http_json(
            f"{TIKTOK_BASE}/campaign/get/",
            params={
                "advertiser_id": account_id,
                "page": 1,
                "page_size": 100,
                "fields": json.dumps(["campaign_id", "campaign_name", "status", "objective_type", "budget", "budget_mode"]),
            },
            headers={"Access-Token": token},
        )
        data = result.get("data", {}).get("list", [])
    return {"platform": platform, "account_id": account_id, "campaigns": data}


@router.get("/insights/{platform}")
async def insights(platform: str, user: dict = Depends(require_active_subscription)):
    if platform not in {"meta", "tiktok"}:
        raise HTTPException(status_code=400, detail="Platform Ads tidak didukung.")
    doc = await db.ad_connections.find_one({"tenant_id": user["tenant_id"], "platform": platform})
    if not doc or not doc.get("selected_account_id"):
        raise HTTPException(status_code=404, detail="Akun Ads belum dipilih.")
    token = _decrypt(doc["access_token"])
    account_id = doc["selected_account_id"]
    if platform == "meta":
        result = _http_json(
            f"{META_GRAPH}/{account_id}/insights",
            params={
                "fields": "spend,impressions,clicks,ctr,cpc,cpm,actions",
                "date_preset": "last_30d",
                "access_token": token,
            },
        )
        return {"platform": platform, "period": "30 hari terakhir", "data": result.get("data", [])}
    return {
        "platform": platform,
        "period": "30 hari terakhir",
        "data": [],
        "note": "Pelaporan TikTok dapat ditambahkan memakai Reporting API setelah akun terhubung.",
    }
