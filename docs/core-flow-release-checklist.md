# ArcheoVault core-flow release checklist

Use separate browser profiles for the administrator, assistant, professor and
viewer. Use synthetic records only. A release fails if a user can perform an
action outside their role, if a successful action is not visible after refresh,
or if an uncertain request encourages the user to repeat a write blindly.

## Preconditions

- `/api/v1/health` returns `200`.
- `/api/v1/health/ready` returns `200` with `database=ok` and `mayan=ok`.
- System Administrator, Research Assistant, Research Professor and Research
  Viewer test accounts are active and assigned to their matching groups.
- The test document type is connected to the Research Document Review workflow.
- The test uses a cabinet and tag that contain no sensitive information.

## Administrator setup

1. Open **Manage users**, create the assistant, professor and viewer, and verify
   their displayed group and role.
2. Open **Share records**. Search by username, group and role; verify each search
   resolves the expected audience.
3. Select the test cabinet and grant **Viewer** cabinet access. Confirm the UI
   states that cabinet access does not unlock contained documents.
4. Select the test document and preview each preset before saving:
   **Viewer**, **Contributor**, **Reviewer**, and **Manager**.
5. Save a preset and verify **Who currently has access?** lists the role and its
   active members. Confirm **Access history** records actor, audience, preset and
   time.

## Assistant capture and correction flow

1. Sign in as the assistant and upload one synthetic file.
2. Supply required metadata, a tag and the test cabinet.
3. Open the created record and confirm preview, metadata, colored tag, cabinet
   path, version history and Record Readiness.
4. Start or submit the configured review. The assistant must not see approval or
   request-correction actions while the review is with the professor.
5. After the professor requests correction, verify the assistant receives a
   notification linked to the document and can read the correction comment.
6. Upload a corrected version or update the requested metadata, then select
   **Resubmit for Review**. The professor must receive the resulting update.

## Professor review flow

1. As administrator, assign the active review to the professor with a priority
   and due date. Assignment also establishes the narrow Reviewer ACL.
2. Sign in as the professor. Verify the notification, My Work count and Review
   Queue all identify the same record.
3. Open the record and request correction with a mandatory explanation.
4. After assistant resubmission, approve the record. The professor must not be
   offered the assistant-only resubmit action.
5. Confirm approved records leave the open review queue.

## Viewer and administrator verification

1. Grant the viewer **Viewer** access to the approved document.
2. As viewer, confirm preview/download and metadata are available but editing,
   upload-version, organization changes and workflow decisions are absent or
   rejected with a clear `403` message.
3. As administrator, confirm the document activity shows upload, organization,
   review transitions and final state.
4. Confirm access history identifies every access change made through
   ArcheoVault.

## Failure and recovery checks

- Expire a session and verify the next API request returns the user to sign-in.
- Temporarily stop the application API and verify loading becomes a friendly
  retryable error rather than a blank page.
- Request an unknown route and verify the ArcheoVault 404 page.
- Stop Mayan in a test environment and verify `/api/v1/health/ready` returns
  `503` while liveness remains available.
- Run the deployment smoke check and verify both the portal and readiness URL.
- Follow `backup-and-recovery.md` to validate a copied SQLite backup with
  `PRAGMA integrity_check`.

## Release evidence

Record the tested commit, accounts/roles (never passwords), document ID,
workflow outcome, test date, failures, and screenshots of the final access and
review states. Do not approve production deployment until all blocking failures
are resolved or explicitly accepted by the product owner.
