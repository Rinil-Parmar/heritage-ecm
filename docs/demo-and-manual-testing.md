# ArcheoVault demo and manual testing guide

Use this guide to prepare a small synthetic organization, demonstrate the product,
and manually verify the complete document lifecycle. Do not upload real research,
personal, culturally sensitive, or confidential information during testing.

## 1. What is being demonstrated

ArcheoVault is the user-facing research portal. Mayan EDMS remains the system of
record for document files, metadata, versions, tags, cabinets, events, users,
permissions, and workflows. FastAPI signs each request with the current user's
Mayan token; it does not bypass Mayan permissions.

The demonstration covers:

- account and group administration;
- role-based document and cabinet access;
- document upload, preview, download, and version history;
- structured metadata, colored tags, and hierarchical cabinets;
- comments and activity history;
- review assignment, notifications, correction, and approval;
- permission-filtered dashboard, navigation, and Smart Search;
- deployment and production verification.

## 2. Test roles and browser sessions

Use separate browser profiles or an Incognito window for each account. This avoids
one login replacing another application's session.

| Test account | Mayan group | Product responsibility |
| --- | --- | --- |
| Existing administrator | System Administrators | Configuration, accounts, ACLs, assignments |
| `ecm.qa.professor` or `rinilparmar` | Research Professors | Review and approval |
| `ecm.qa.assistant` | Research Assistants | Upload and record maintenance |
| `ecm.qa.viewer` | Research Viewers | Read-only verification |

Access reaches a user through this chain:

```text
User -> Group -> Role -> Object ACL -> Effective permission
```

A role label by itself does not grant a user access. The user must belong to the
role's linked group, and the role must receive access to the selected document or
cabinet.

## 3. One-time organization setup

Perform system configuration in the existing Mayan administration interface.
Perform normal user work and the final demonstration in ArcheoVault.

### 3.1 Create a synthetic document type

Create this document type:

```text
ECM QA Archaeological Record
```

Document types connect records to metadata definitions and workflows.

### 3.2 Create and attach metadata types

| Metadata type | Required | Test value |
| --- | --- | --- |
| Site name | Yes | Site Alpha |
| Country | Yes | Canada |
| Research year | Yes | 2026 |
| Lead researcher | No | Rinil Parmar |
| Record status | Yes | Draft |
| Collection reference | No | QA-2026-001 |

Attach every metadata type to `ECM QA Archaeological Record`. Required fields
must be enforced during upload.

### 3.3 Connect the review workflow

Connect `ECM QA Archaeological Record` to `Research Document Review`.

Expected states:

```text
Submitted -> Under Review -> Approved
                         \-> Needs Correction -> Under Review
```

The workflow is not displayed for document types that are not connected to it.

### 3.4 Create a cabinet hierarchy

```text
ECM Quality Assurance
└── 2026 Test Project
    ├── Site Alpha
    ├── Site Beta
    └── Reference Material
```

Cabinets provide hierarchical navigation. They do not automatically grant access
to the documents they contain.

### 3.5 Create colored tags

| Tag | Suggested color |
| --- | --- |
| Needs Review | Orange |
| Field Record | Green |
| Test Data | Blue |
| Restricted | Red |

Tags provide flexible classification that can cross document types and cabinets.

## 4. Prepare users and access

### 4.1 Create or edit users

In **Manage users**, create the synthetic accounts or edit existing accounts.
Verify that each account belongs to the expected group. The Access control page
must show the username under **Who will receive this access** before a grant is
applied.

### 4.2 Grant cabinet access

In **Access control**, select scope **Cabinet** and apply:

| Cabinet | Role | Bundle |
| --- | --- | --- |
| ECM Quality Assurance | Research Professor | Browse |
| 2026 Test Project | Research Professor | Browse |
| Site Alpha | Research Professor | Browse |
| Site Alpha | Research Assistant | Organize |
| Site Alpha | Research Viewer | Browse |

Grant Browse on the required parent cabinets so users can navigate to a child.

### 4.3 Grant document access after upload

| Role | Document bundle | Expected result |
| --- | --- | --- |
| Research Viewer | Read only | Open, preview, download, and read record context |
| Research Assistant | Contributor | Maintain record data and upload versions |
| Research Professor | Reviewer | Read the full record and make review decisions |

Reviewer access also gives the role narrow visibility of the shared review
workflow. It does not make other documents visible.

## 5. Upload the demonstration document

Use a small synthetic PDF or PNG so inline preview can be demonstrated.

```text
Filename: ECM-QA-Site-Alpha-2026.pdf
Document type: ECM QA Archaeological Record
Title: Site Alpha Test Excavation Report
Description: Synthetic archaeological record for ArcheoVault acceptance testing.
```

Metadata:

```text
Site name: Site Alpha
Country: Canada
Research year: 2026
Lead researcher: Rinil Parmar
Record status: Draft
Collection reference: QA-2026-001
```

Classification:

```text
Tags: Needs Review, Field Record, Test Data
Cabinet: ECM Quality Assurance / 2026 Test Project / Site Alpha
```

Record the created ID:

```text
Test document ID: __________
```

Expected result:

- upload completes once without duplication;
- title, description, metadata, tags, and cabinet path are correct;
- PDF or image preview loads;
- original file downloads;
- version 1 and creation activity are present.

## 6. Ten-minute demonstration script

1. Open the landing page and briefly explain the product's research-record purpose.
2. Sign in as the administrator and show **My Work**, cabinets, and Smart Search.
3. Open the synthetic record and show preview, metadata, colored tags, cabinet
   path, versions, discussion, activity, and workflow.
4. Open **Manage users** and show that accounts receive groups rather than direct
   permissions.
5. Open **Access control** and show the User -> Group -> Role -> ACL chain.
6. Start the review workflow and assign it to `rinilparmar` with High priority.
7. In a separate browser session, sign in as `rinilparmar`.
8. Show the notification, My Work assignment, and Review Queue entry.
9. Request a correction with a required explanation.
10. Sign in as the assistant, update metadata or upload a corrected version, and
    resubmit it.
11. Return to the professor session and approve the record.
12. Show the final workflow state, version history, and activity audit trail.
13. Search for `records from Canada in 2026 at Site Alpha` and open the result.

## 7. Full manual acceptance test

### A. Authentication and navigation

- [ ] Valid user can sign in.
- [ ] Invalid credentials show a safe error.
- [ ] Active session visiting Sign in returns to the application.
- [ ] Refreshing a deep application link preserves the current page.
- [ ] Sign out removes access to protected pages.
- [ ] Unauthenticated document URLs redirect to Sign in.
- [ ] Sidebar can be resized and scrolled.
- [ ] Cabinet hierarchy expands, collapses, searches, and navigates correctly.

### B. Administrator flow

- [ ] Manage users is visible only to authorized administrators.
- [ ] Administrator can create a user with a strong temporary password.
- [ ] Administrator can edit profile fields and group membership.
- [ ] Access control lists the correct role-to-group mapping and active members.
- [ ] Empty groups cannot receive an accidental grant through the portal.
- [ ] Applying an access bundle updates and verifies the Mayan ACL.
- [ ] Existing unrelated custom permissions remain unchanged.
- [ ] Review can be assigned, reassigned, prioritized, dated, and unassigned.

### C. Research Viewer flow

- [ ] Only authorized documents and cabinets are visible.
- [ ] Preview and download work when granted.
- [ ] Metadata, tags, cabinets, comments, activity, versions, and review status load.
- [ ] Unauthorized edits are rejected and save nothing.
- [ ] Administration navigation is hidden.

### D. Research Assistant flow

- [ ] Upload works with required metadata, tags, and cabinet selection.
- [ ] Title, description, language, and metadata can be updated when granted.
- [ ] Tags can be attached and removed.
- [ ] Authorized cabinet membership can be changed.
- [ ] A comment can be posted.
- [ ] A new document version can be uploaded.
- [ ] Earlier versions remain visible.
- [ ] Activity records the changes.

### E. Research Professor flow

- [ ] Assignment notification appears.
- [ ] My Work shows the assigned document.
- [ ] Review Queue shows the actual workflow state.
- [ ] Opening the document shows permitted transitions.
- [ ] Request Correction requires an explanation.
- [ ] Resubmitted work returns to review.
- [ ] Approve moves the record to a final 100% state.
- [ ] Approved work leaves the open queue.

### F. Search and filtering

Test these prompts:

```text
Find records from Canada in 2026
Find Site Alpha excavation records
Find documents tagged Field Record
Find records in the Site Alpha cabinet
```

- [ ] Results contain the synthetic record when the account has access.
- [ ] Result links open the correct record.
- [ ] The interpreted filters are understandable.
- [ ] A user cannot discover records they cannot access.
- [ ] Standard search continues to work when AI interpretation is disabled.

### G. Reliability and security

- [ ] Browser Network panel has no unexpected 404 or 500 responses.
- [ ] Failed writes show a clear message and do not silently succeed.
- [ ] Refresh recovers data after a temporary request failure.
- [ ] Duplicate clicks do not create duplicate uploads or workflow actions.
- [ ] Direct navigation to administration is denied to normal users.
- [ ] No password, API token, or secret appears in browser storage or logs.

## 8. Deployment demonstration

Application deployment builds the selected `main` commit into new React and
FastAPI images. It does not redeploy or replace the existing Mayan stack.

1. Merge a validated PR into `main`.
2. Open **GitHub Actions -> Deploy ArcheoVault application -> Run workflow**.
3. Select branch `main`.
4. Wait for the cloud image build.
5. Approve the `mayan-production` environment gate.
6. Keep the university VM self-hosted runner online.
7. Wait for image checksum, container startup, health checks, and public HTTPS
   checks to pass.
8. Open `https://archeoecm.cs.uwindsor.ca/portal/` and perform an authenticated
   document smoke test.

Useful VM checks:

```bash
cd ~/ECM_Archeology/deployment/application
docker compose -p archeoecm-application -f "releases/$(cat current-release)/compose.yaml" ps
docker compose -p archeoecm-application -f "releases/$(cat current-release)/compose.yaml" logs --tail=100
curl --fail --silent https://archeoecm.cs.uwindsor.ca/api/v1/health
```

The Mayan deployment is separate. Follow [deployment-pipeline.md](deployment-pipeline.md)
for Mayan and [application-deployment.md](application-deployment.md) for the portal.

## 9. Pass criteria

The release is ready for demonstration when:

- [ ] all role and group mappings are correct;
- [ ] the synthetic document completes the upload-to-approval lifecycle;
- [ ] each role sees only the appropriate records and actions;
- [ ] cabinets, metadata, tags, preview, download, versions, comments, and activity work;
- [ ] assignments appear consistently in notifications, My Work, and Review Queue;
- [ ] Smart Search respects permissions;
- [ ] repository validation, image build, deployment, and public smoke checks pass;
- [ ] the original Mayan interface remains operational.

## 10. Failure report template

Capture one report per failure:

```text
Date and time:
Environment: local or production
Account and group:
Page URL:
Document ID:
Action performed:
Expected result:
Actual result:
HTTP status and response message:
Screenshot:
Reproducible after refresh: yes/no
```

Do not include passwords, session cookies, API tokens, or sensitive document data.
