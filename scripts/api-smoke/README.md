# Mayan API smoke test

This read-only test checks the public HTTPS API, anonymous access control, token
authentication, and the authenticated document-list endpoint. It does not create,
modify, upload, or delete data.

Run it from Windows PowerShell on a development laptop:

```powershell
cd D:\Internship_Project_2\heritage-ecm
powershell -ExecutionPolicy Bypass -File .\scripts\api-smoke\Test-MayanApi.ps1
```

Enter a Mayan username and password when prompted. Use an ordinary test user after
assigning its intended group; a superuser is acceptable only for the initial
connectivity check. The password is read as a secure value. The returned token is
held in process memory and is never printed or written to disk by this script.
Mayan controls the token's server-side lifetime; do not assume it expires when the
script exits.

Expected final output:

```text
PASS: API endpoint responded ...
PASS: Anonymous document access was denied ...
# or: Anonymous listing is reachable but exposes zero documents.
PASS: Mayan authenticated the user ...
PASS: Authenticated document listing returned HTTP 200 ...
API SMOKE TEST PASSED
```

Mayan can return HTTP 200 with a permission-filtered empty anonymous collection.
If the test reports that anonymous access can see one or more documents, review
anonymous permissions before frontend work. An authenticated result with zero
visible documents still proves authentication and API connectivity. It does not
prove that document ACLs are configured. Run the test later with representative
non-superuser accounts to validate authorization.

Do not place passwords or tokens in source files, shell history, `.env` files that
are committed, screenshots, GitHub Actions logs, or issue comments.
