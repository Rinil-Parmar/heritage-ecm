# ArcheoECM frontend

React and TypeScript frontend for the ArcheoECM research document system.
The frontend communicates with the configured ECM API and does not access its
database or document storage directly.

## Requirements

- Node.js 20.19+ (this project was initialized with Node.js 20.20.2)
- npm 10+

## Local development

```powershell
cd D:\Internship_Project_2\heritage-ecm\frontend
npm install
npm run dev
```

Start the [FastAPI backend](../backend/README.md) on port 8001 in a second terminal.
Open http://localhost:5173/sign-in. Vite proxies `/api/v1` to FastAPI using
`ECM_BACKEND_ORIGIN` (default http://127.0.0.1:8001). The older read-only `/api/v4`
probe still targets the ECM origin configured by `ECM_API_ORIGIN`.
No credentials belong in environment variables for the frontend or repository files.
Restart Vite after changing proxy configuration.

The sign-in page uses existing accounts and redirects to `/app` on success.
The application now lists real documents accessible to the signed-in account,
with pagination and refresh. Select a title to open its detail page, preview a
supported original file, or download it. Empty, loading, and service/permission
error states are included. The upload screen loads metadata fields for the chosen
document type and supports one file up to 50 MB, upload progress, and metadata-only
recovery after partial success. Saved metadata is shown on the record detail page.
Upload includes searchable multi-selects for existing tags and cabinets, with
cabinet paths, optional selections, and retry of incomplete assignments on the
same record. The detail page shows tags/cabinets returned for the current user.
Search across documents and standalone cabinet browsing follow later.
Existing records now include **Edit metadata** with current-value loading,
required-field validation, save/cancel, and partial-save error handling.
API tokens are never stored in localStorage or returned to React. The browser
holds an HttpOnly session cookie, and CSRF state stays in component memory.

## Verification

```powershell
npm run lint
npm run test
npm run typecheck
npm run build
```

The production deployment and Nginx route will be added after the local landing
page and API connection are reviewed.
