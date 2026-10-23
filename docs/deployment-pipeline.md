# Mayan deployment pipeline

The `Deploy Mayan to university VM` workflow operates the existing Mayan stack
on `archeoecm.cs.uwindsor.ca`. Its production Compose file and `.env` remain on
the VM at `~/ECM_Archeology/deployment/mayan/`; the local proof-of-concept
Compose file in `infra/mayan/` is not used for production deployment.

The workflow is manually started from `main` in GitHub Actions. It first checks
the rootless Docker context and validates the VM's Compose file without printing
resolved environment values. The default operation is `validate`, which makes
no service changes. Selecting `deploy` adds a second job protected by the
`mayan-production` GitHub Environment. That job pauses for environment approval
before it pulls configured images, applies the existing Compose file, and waits
for Mayan at `http://127.0.0.1:8080/`.

The approval gate must be configured in GitHub under **Settings → Environments
→ mayan-production**. Require approval from the repository owner and restrict
deployments to `main`. The selected approver is the workflow owner, so leave
“Prevent self-review” disabled if the owner is also starting the deployment.

The GitHub self-hosted runner must remain online for both jobs. It runs only
workflow jobs that request the `ecm-deploy` label; pull request CI continues to
run on GitHub-hosted runners. Do not add the production `.env`, uploaded
documents, database files, or backups to Git.

This is a controlled redeploy of the Compose configuration already on the VM.
It does not make the VM's Compose file version-controlled; a later deployment
improvement is to review and commit a sanitized production Compose file to the
repository, then have CI deploy that reviewed version.
