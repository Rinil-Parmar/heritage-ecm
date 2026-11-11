# ArcheoECM backend

Python FastAPI provides the application API between React and Mayan's supported REST API.
Mayan remains the document and permission system of record. We do not write directly
to its database or duplicate its document storage.

## Stage 3: local document library

Implemented: process health endpoint, environment configuration, and a read-only
API connectivity probe, per-user login, session lookup, logout, and paginated
document listing. VM deployment is not implemented yet. Do not expose this
development server publicly.

Use Python 3.13. In PowerShell:

```powershell
cd D:\Internship_Project_2\heritage-ecm\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m app.mayan
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

If `.env` already exists, preserve it instead of copying the example again.
Open http://127.0.0.1:8001/docs to try `GET /api/v1/health`.
Expected response: `{"status":"ok","service":"archeoecm-backend"}`.
Stop the server with Ctrl+C. A successful health response only proves this
backend is running. The separate probe checks API-root JSON, not authentication.

## Structure

```text
backend/
  app/
    config.py       Environment settings
    auth.py         Per-user authentication and logout
    sessions.py     Bounded in-memory development sessions
    documents.py    Permission-scoped document list via the upstream API
    main.py         FastAPI application and health endpoint
    mayan.py        Read-only upstream connectivity probe
  tests/            Isolated tests; no university access required
  .env.example      Non-secret configuration template
```

## Sign-in flow and manual check

1. Start this backend on port 8001 (command above).
2. In a second terminal, run `npm run dev` from `frontend/`.
3. Open http://localhost:5173/sign-in and use an existing Mayan account.
4. Expect the document library, then refresh: the session should remain.
5. Sign out. Visiting `/app` should redirect to sign-in.
6. Try an incorrect password: expect an error and no session. Ten login attempts
   per connection address per minute are allowed during local development.

React posts to `/api/v1/auth/login` through Vite. FastAPI calls Mayan's
`auth/token/obtain/` endpoint and stores the returned token in memory. The browser
gets only an opaque HttpOnly, SameSite=Strict session cookie; no API token is
returned. `GET /api/v1/auth/session` returns the username and CSRF token.
`POST /api/v1/auth/logout` requires the trusted Origin and `X-CSRF-Token` header.
Login also requires an explicitly trusted Origin. Validation errors never echo
submitted credentials. Authentication responses use `Cache-Control: no-store`.

Sessions last one hour and do not survive backend restart/reload. Run one worker
locally. Logout removes the local session; it does not revoke the upstream Mayan
token or sign the user out of Mayan's own UI. The session check confirms local
session validity; future document requests must handle upstream token revocation
and permissions on every operation.

The current store and login limiter are process-local development implementations.
Before production, replace them with a dedicated shared session store/limiter,
set `ECM_COOKIE_SECURE=true`, and explicitly configure the HTTPS frontend origin.
Keep that store separate from Mayan's cache. Never log passwords or tokens.

Troubleshooting:
- Connection error: confirm both local servers are running; restart Vite after
  proxy changes. Vite requires port 5173 rather than silently switching ports.
- 403: check `ECM_TRUSTED_ORIGINS` matches the browser origin exactly.
- 401: check the username/password in Mayan. Session expiry also returns 401.
- 502/503: check university network/VPN access and `ECM_MAYAN_API_URL`.
- 429: wait a minute before retrying.

## Document library

`GET /api/v1/documents?page=1` requires a session. FastAPI calls the fixed upstream
`/api/v4/documents/` path with the user's token. Mayan filters records using that
user's permissions. The response exposes only summary fields and local page
numbers; upstream pagination URLs are never followed or sent to the browser.
Page length uses Mayan's configured default. Counts refer to accessible records,
not all organization records. An empty list can mean no records or no grants.

An upstream 401 invalidates the local session. A 403 reports insufficient access;
network failures and malformed responses return controlled errors. The API does
not return upstream error bodies or credentials.

Manual review: open `/app`, compare the list with the same user's Mayan access,
select a title, refresh, and try pagination when enough records exist. Use a
restricted test account to verify that unauthorized documents remain absent.
The current step has not been live-verified against an authenticated VM session.

## Next increment

Add upload through the same per-user permission boundary. Never use a shared
administrator token.

## Document details and original files

The detail screen uses `GET /api/v1/documents/{id}`. The file route is
`GET /api/v1/documents/{id}/file`, with `?preview=true` for inline viewing.
Both resolve the record using the current user's token. The file route resolves
the latest file from that record and calls Mayan's authenticated file-download
endpoint, which independently enforces download permission. No user-supplied
upstream URLs are accepted and redirects are not followed.

Only PDFs, JPEG, PNG, WebP, and GIF files up to 20 MB support inline preview.
HTML/SVG and other formats are download-only. Preview shows the original file,
not Mayan's transformed active document version. Files stream through FastAPI
without writing copies to disk. The frontend currently buffers downloads as a
Blob to show permission/network errors; large-file native streaming downloads
are a later improvement. Inline preview also requires file-download permission.

Manual review: open a document title, inspect the fields, preview a PDF/image,
download and open the original, then repeat with a restricted user. Test a record
without a file and a format without preview support. No automated suite or live
browser verification was run for this increment.

Before deployment, lock tested dependencies, add backend CI checks, and extend
the approval-gated deployment to build and run this service. Existing Mayan CD
does not automatically deploy this backend.
