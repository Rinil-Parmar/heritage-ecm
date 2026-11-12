# Permission-aware document controls

## What changes

React asks FastAPI for the current user's document capabilities. FastAPI forwards the session's Mayan token to a read-only Mayan extension. The extension evaluates Mayan's own ACL manager, including global permissions and inherited access. It never accepts a user ID to impersonate and never grants permissions.

Controls covered: document details, research metadata, new file versions, comments, original download/preview, and individual tag/cabinet add/remove selections. Metadata editing currently requires add, edit and remove together because its form can perform all three operations. This is deliberately conservative.

Writes still go through Mayan's existing endpoints with the same user token. Existing CSRF checks remain in FastAPI. Capabilities describe access when fetched; upstream enforcement remains authoritative if permissions change later. Refresh record reloads capabilities.

If the extension is absent or unavailable, the document remains readable but these controls are unavailable. The page displays an explanation and refresh instructions. There is no role-name fallback, admin token, or permissive default.

## VM installation prerequisite — not performed yet

This change requires a custom Mayan image containing `extensions/mayan-access`. It has no database models or migrations. Do not replace the running image before validating it against the installed Mayan release and taking the usual deployment backup.

From the repository root, build an image (prefer an immutable base digest during release):

```bash
docker build -t archeoecm-mayan:access-v1 extensions/mayan-access
```

In the production Compose configuration, select that image and add this to the shared Mayan environment mapping:

```yaml
MAYAN_COMMON_EXTRA_APPS: '["archeoecm_access.apps.ArcheoECMAccessApp"]'
```

If extra apps are already configured, retain them and append this app. Keep the existing inherited environment entries, volumes, project name `archeoecm`, secrets, and proxy configuration. The app must be installed in every Mayan container using this setting. Build and publish the image through the deployment pipeline before changing production; do not install packages interactively in the running container.

The registered endpoint is `GET /api/v4/archeoecm/documents/{id}/access/`, using normal Mayan token authentication. The response has `schema_version: 1`, boolean capabilities, and permitted tag/cabinet IDs. No credentials, ACL contents or user membership information are returned.

## Required release verification

1. Validate the custom image starts and registers the endpoint against the deployed Mayan version. Implementation was reviewed against upstream source; runtime compatibility is still unverified.
2. Confirm anonymous requests are denied and another user's inaccessible document returns no capability data.
3. Compare an administrator, a read-only viewer and an object-ACL user against the Mayan UI. Verify grants on individual tags/cabinets and inherited document-type grants.
4. Verify permitted edits work, unavailable controls are absent, and rejected direct write requests remain rejected.
5. Revoke access with a page open. A subsequent write must be rejected upstream; refreshing must update the controls.
6. Temporarily make the access endpoint unavailable: editing must stay unavailable and recovery via Refresh record must work.

No suite or VM installation has been run for this milestone. Local TypeScript compilation and Python syntax checks are not substitutes for these checks.
