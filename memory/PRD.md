# PRD — WiFi Coverage Checker & Multi-Tenant SaaS (Phase 1)

## Original Problem Statement
Production-oriented, mobile-first multi-tenant SaaS for ISPs to let customers check WiFi/fiber coverage at their location and capture leads. Phase 1 = working foundation only (no billing/payment/OTP/subdomain provisioning/ads). Architecture must be extensible for Phase 2.

## Tech Stack / Architecture
- **Backend**: FastAPI (service-oriented modules), MongoDB (motor). Auth = JWT in httpOnly cookies (bcrypt), brute-force lockout, RBAC (SUPER_ADMIN / SUB_ADMIN), audit logs.
- **GIS engine**: MongoDB **2dsphere** geospatial index. Coverage computed **server-side** via `$geoNear` (spherical). COVERED = inside polygon OR distance-to-boundary ≤ 100 m.
- **GIS parsing**: KMZ (unzip)/KML/GeoJSON parsed in-memory (shapely validate + orient), only Polygon/MultiPolygon stored; points/lines skipped. Async background processing (UPLOADED→PROCESSING→READY/FAILED). Viewport-based geometry loading for the map (capped).
- **Frontend**: React + react-router + vanilla Leaflet (OpenStreetMap tiles) + Tailwind. Tenant-driven primary color via CSS variable `--primary`.
- **Tenant isolation**: enforced server-side; tenant context derived from authenticated user (admin) or resolved from hostname/`?subdomain=`/`/t/:subdomain` fallback (public). Client-supplied tenant_id never trusted.

## User Personas
- **Public Customer** (no login): checks coverage, submits Name+WhatsApp.
- **Sub Admin**: manages own tenant coverage/packages/leads/branding.
- **Super Admin**: default tenant admin + tenant-management foundation.

## Core Requirements (static)
Multi-tenant data isolation, immediate lead persistence (NOT_CHECKED before location), Indonesian phone normalization → 628xxxxxxxxxx, GPS + manual (fixed-center-pin) location, FAB state machine, 100 m server-side coverage, tenant WhatsApp routing, admin dashboard (coverage/packages/leads/branding/account), security foundation.

## Implemented (2026-06)
- Auth (login/logout/me, cookies, bcrypt, lockout), RBAC, audit logging.
- Default tenant + Super Admin seeded (febryansyaharbi@gmail.com). 3 demo packages (flagged `_demo`).
- 4 initial GIS files imported to default tenant only: JBG (2682), JULI (4761), NGANJUK (87), BLITAR-KML (2666) = **10,196** active polygons. 2dsphere index.
- Coverage check API (inside/≤100m/outside) verified.
- Public landing (header/hero/packages/coverage/footer), lead form, full-screen Leaflet map (fixed-center pin + pan + tap + GPS), FAB state machine, covered/uncovered modals, WhatsApp CTA using current tenant number.
- Admin: dashboard stats, coverage management (upload/preview/activate/deactivate/delete + status polling), packages CRUD, leads (pagination/search/status+date filters), branding (logo upload as data URL, color picker), account.
- Tests: 27/27 backend pytest (`/app/backend/tests/backend_test.py`) + frontend E2E pass.

## Backlog / Postponed to Phase 2 (P1/P2)
- Billing/Subscription/Invoice/Payment webhook + states (schema-ready, not implemented).
- Real WhatsApp OTP provider (WhatsAppService interface pending).
- Automatic subdomain provisioning + wildcard DNS (path fallback used now).
- Expiration/grace-period scheduler, tenant LOCKED enforcement UI ("Halaman Non-Aktif" page exists).
- Advertising/analytics. Forgot-password / change-password UI. Object storage for uploads (GIS parsed in-memory; logos stored as data URLs).
- Rate limiting on public POST /api/leads (advisory from review).

## Known Limitations
- `city` may be null (no reverse geocoder integrated).
- Provided `01-logo.jpg` bytes were not retrievable via the assets API; logo upload works and default renders WiFi-name lockup — admin can upload the real logo in Branding.
- Coverage geometries capped at 1500 features per viewport request for performance.

## Next Tasks
- Phase 2 kickoff: billing + subscription lifecycle; real WhatsApp OTP; tenant creation flow for Sub-Admins (empty coverage on create).
