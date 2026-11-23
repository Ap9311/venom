# Security Summary

This walkthrough documents the security hardening and bug fixes implemented across the Nonum frontend, serverless API endpoints (`/api/*`), local Express server (`server.ts`), hosting configuration (`vercel.json`), and Firestore security rules (`firestore.rules`).

## Key Protections Implemented

1. **Strict Admin Token & Session Enforcement**
   - `/api/admin-token` now verifies that the requested `adminDeviceId` is actively registered in the server-managed `admin_devices` registry and rejects unknown or revoked IDs with `401`/`403` and no token.
   - Replaced the single shared static admin token with short-lived HS256-signed JWTs (`signSessionToken` / `verifySessionToken`) bound to each device ID and role (`admin` = 4 hours, `assistant` = 2 hours).
   - `/api/admin-verify` validates token signature, structure, expiration, and active device status.
   - `/api/assistant-auth` issues a separate `role: "assistant"` JWT with zero cookies and no admin device ID creation. Full-admin-only endpoints (`/api/admin-revoke`, `/api/admin-update-limit`, `/api/admin-assistant-creds`, `/api/get-ip`) reject assistant tokens.

2. **Fail-Closed Secrets & Zero Client/Repo Leaks**
   - Removed all hardcoded secret fallbacks, default credentials, password hashes, owner IP addresses, device-ID salts, and secret assistant portal paths from source files and compiled `dist/` bundles.
   - When `ADMIN_SECRET_KEY` is missing, authentication endpoints fail closed with `500` instead of falling back to a default key.
   - Admin and assistant credentials are verified exclusively on the server using salted `scrypt` hashing and timing-safe comparison.
   - The secret assistant portal path is resolved server-side via `/api/portal-resolve` using the `ASSISTANT_PORTAL_PATH` environment variable, never bundled into client JavaScript.

3. **Brute-Force Rate Limiting & Anti-Abuse Controls**
   - Added per-IP rate limiting (5 failed attempts -> 15-minute lockout with `429` + `Retry-After`) to `/api/admin-auth`, `/api/admin-login`, `/api/assistant-auth`, and `/api/community-pin`, keyed by a salted server-side HMAC hash of the caller IP.
   - Restricted CORS headers to an explicit origin allowlist (`https://nonum.online`, `https://admin.nonum.online`, `https://www.nonum.online`, and local dev hosts) with `Access-Control-Allow-Credentials: true`, plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Strict-Transport-Security` headers.
   - Added CSRF Origin/Referer verification on state-changing routes and `HttpOnly; SameSite=Strict; Secure` session cookies for admin sessions.

4. **Firestore Access Controls & Privacy Cleanup**
   - Tightened `firestore.rules` so sensitive administrative collections (`private_config`, `admins`, `admin_devices`, `admin_config`, `community_secrets`, `rate_limits`, `blocked_ip_hashes`) are locked down to verified server/admin contexts, separated `isAdmin()` from `isAssistant()`, scoped `interactions` to the signed-in anonymous UID, blocked PII fields (`ipAddress`, `imei`, `pin`, `pinHash`) on public posts/comments/communities/chats, and restricted public report increments to `+1` per report.
   - Removed raw IP/IMEI collection from public client flows and moved community PIN verification to `/api/community-pin` using salted `scrypt` hashes stored only in server-only `community_secrets`.
   - Added a one-time cleanup script (`scripts/strip-pii-migration.ts`) to strip legacy PII fields from existing Firestore documents once deployed.

5. **Functional & UI Fixes**
   - Served `/ads.txt` directly as `text/plain` without SPA HTML fallback.
   - Fixed duplicate mobile install icon behavior, replaced external `iili.io` icon URLs with local `/nonum-logo.png`, fixed invalid `<meta name="apple-mobile-web-app-capable">` tag, resolved modal scroll/close usability issues, and stabilized post/community report & comment flows.

---

## PoC Verification

All verification checks below were run locally against the updated handlers, server, and compiled production bundle without touching real Firestore data.

### 1. Static & Compiled Bundle Leak Scan
- Scanned `src/`, `api/`, `public/`, `index.html`, `server.ts`, `vercel.json`, and the compiled `dist/` bundle.
- Confirmed **zero** occurrences of previously exposed credentials, hardcoded fallback secrets, owner IP addresses, secret assistant route paths, `getDeviceImei`, `iili.io`, or legacy preview hostnames.

### 2. Fail-Closed & Hosting Header Verification (Live Local Dev Server)
- `POST /api/admin-token` (with no `ADMIN_SECRET_KEY` set) -> `500` fail-closed (`"Server authentication is not configured."`), no token returned.
- `POST /api/admin-verify` (forged token) -> `500` fail-closed (`isAdmin: false`).
- `GET /api/get-ip`, `POST /api/admin-revoke`, `POST /api/admin-update-limit`, `GET /api/admin-assistant-creds` -> all fail closed when unauthenticated.
- `GET /ads.txt` -> `200 OK`, `Content-Type: text/plain; charset=utf-8`, exact 59-byte Google AdSense entry (not HTML).
- `GET /api/admin-gate` with untrusted `Origin: https://evil.example` -> responds with `Access-Control-Allow-Origin: https://nonum.online` (never echoes `*` or the untrusted origin) and includes `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.

### 3. End-to-End API Security Assertions (9/9 Passed)
Executed an isolated `tsx` verification harness against the real `/api/*` handlers with synthetic test environment variables:
1. **Unregistered device ID on `/api/admin-token`**: Rejected with `401` and no token.
2. **Brute-force login lockout on `/api/admin-auth`**: 5 wrong passwords returned `401`; 6th attempt returned `429` with `Retry-After: 900`.
3. **Valid admin login**: Returned `200`, signed HS256 JWT (`role: "admin"`), and `HttpOnly; SameSite=Strict` cookies.
4. **Admin token verification on `/api/admin-verify`**: Valid admin JWT confirmed `isAdmin: true`.
5. **Assistant login on `/api/assistant-auth`**: Returned `200` with a separate `role: "assistant"` JWT and zero `Set-Cookie` headers.
6. **Privilege separation**: Assistant JWT rejected with `401` across `/api/admin-revoke`, `/api/admin-update-limit`, `/api/admin-assistant-creds`, and `/api/get-ip`.
7. **Expired token rejection**: Expired HS256 JWT rejected by `/api/admin-verify` with `401` and `isAdmin: false`.
8. **Server-side community PIN verification (`/api/community-pin`)**: Set salted `scrypt` PIN hash, unlocked with matching PIN (`200`), rejected wrong PIN (`401`).
9. **Server-side portal resolution (`/api/portal-resolve`)**: Matched the configured `ASSISTANT_PORTAL_PATH` and allowed moderation subpaths while rejecting decoy paths and `/audit`.

---

## Remaining External Deployment Steps (Cannot Run From Local Sandbox)

Because your production Firebase project (`venom-9311`), Vercel environment variables, GitHub repository visibility, and GoDaddy DNS/SSL settings live outside this sandbox, complete these steps when deploying:

1. **Rotate & Set Vercel Environment Variables** (see `.env.example`):
   - `ADMIN_SECRET_KEY` (new random 32+ char string)
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` (or `ADMIN_PASSWORD`) — brand-new credentials
   - `ASSISTANT_USERNAME` and `ASSISTANT_PASSWORD_HASH` (or `ASSISTANT_PASSWORD`) — brand-new credentials
   - `ASSISTANT_PORTAL_PATH` (your private assistant portal path)
   - `FIRESTORE_BRIDGE_KEY` (new random 32+ char string)
   - `IP_HASH_SALT` (optional separate 32+ char random string)
   - `OWNER_IP` (optional server-only owner IP)
2. **Create Server Bridge Key Document in Firestore**:
   - In Firebase Console (`venom-9311`) -> Firestore Database, create document `private_config/server_auth` with field `key` set to the exact same value as `FIRESTORE_BRIDGE_KEY`.
3. **Review & Deploy `firestore.rules`**:
   - Review `firestore.rules` carefully and deploy via Firebase Console or `firebase deploy --only firestore:rules`.
4. **Run PII Cleanup Migration**:
   - Run `scripts/strip-pii-migration.ts` against `venom-9311` with admin credentials to strip legacy `ipAddress`, `imei`, and plaintext `pin` fields from existing documents.
5. **GitHub & Domain Hygiene**:
   - Make the `Ap9311/venom` repo private (and purge exposed secrets from git history if it ever remains public).
   - Ensure `www.nonum.online` is added in Vercel Domains with a valid SSL certificate redirecting cleanly to `https://nonum.online`.
