# Deploy React and FastAPI to the university VM

## Addresses and responsibilities

| Component | Address |
| --- | --- |
| Existing Mayan | `https://archeoecm.cs.uwindsor.ca/` |
| React portal | `https://archeoecm.cs.uwindsor.ca/portal/` |
| FastAPI | `https://archeoecm.cs.uwindsor.ca/api/v1/` |
| Existing Mayan API | `https://archeoecm.cs.uwindsor.ca/api/v4/` |

The host Nginx terminates HTTPS. It sends `/portal/` and `/api/v1/` to the application gateway on loopback port 8082. The gateway serves React and proxies FastAPI over its private Docker network. FastAPI contacts the existing Mayan HTTPS API. Its port is not published. Mayan keeps its existing project, containers and volumes.

## 1. Prepare GitHub

Push this feature branch and create a PR to `main`. Wait for **Build React and FastAPI images** and the existing CI checks; review and merge through the protected branch. Add the application build check to the main ruleset's required status checks once GitHub has seen it.

In **Settings → Environments → mayan-production**, confirm:

- Required reviewer is the repository owner.
- Deployment branch restriction permits only `main`.
- Self-review must be allowed if the owner both triggers and approves deployments. Otherwise a second reviewer must approve.
- Prevent administrator bypass if your repository plan/settings support it.

The workflow references this existing environment; YAML does not create required reviewers automatically. Keep PR jobs on GitHub-hosted runners. The deployment runner is used only by the main-only, approval-gated job.

## 2. Prepare the VM once

SSH as `parmar7f`. Run:

```bash
docker context show
docker info --format '{{json .SecurityOptions}}'
ss -ltn '( sport = :8082 )'
mkdir -p ~/ECM_Archeology/deployment/application
chmod 700 ~/ECM_Archeology/deployment/application
nano ~/ECM_Archeology/deployment/application/.env
```

Docker should use `rootless`. Port 8082 must be free; identify its owner before stopping anything if occupied. Paste:

```dotenv
ECM_MAYAN_API_URL=https://archeoecm.cs.uwindsor.ca/api/v4/
ECM_TRUSTED_ORIGINS=["https://archeoecm.cs.uwindsor.ca"]
ECM_COOKIE_SECURE=true
ECM_SESSION_SECONDS=3600
```

Save, then run:

```bash
chmod 600 ~/ECM_Archeology/deployment/application/.env
```

No Mayan administrator password or token belongs in this file. Each user signs in with their own account.

## 3. Add Nginx routes once

Find the active site file:

```bash
sudo nginx -T 2>&1 | grep -E '^# configuration file|server_name|listen.*443'
```

Back up that exact site file before editing it. Inside its existing HTTPS `server` block, insert the contents of [`infra/application/nginx-locations.conf`](../infra/application/nginx-locations.conf). Keep the current `location /`, certificate paths, and other Mayan settings. Do not create duplicate location blocks if these routes already exist.

Validate and reload only if valid:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

The portal may show 502 until its first deployment. The original Mayan homepage should still work. No additional public firewall port is needed.

## 4. Confirm the runner

GitHub → Settings → Actions → Runners: `archeoecm-runner` should be **Idle**, with label `ecm-deploy`, running as `parmar7f`. It must see the same rootless Docker context.

If you have not installed a runner service, start it in its own SSH terminal:

```bash
cd ~/actions-runner
./run.sh
```

Keep that terminal open during deployment. If a service already runs the runner, do not start a second copy.

## 5. Deploy

1. GitHub → Actions → **Deploy ArcheoECM application** → **Run workflow**, branch **main**.
2. The build job creates both images from that commit on a GitHub-hosted runner and uploads a checksummed release artifact.
3. Open the run → **Review deployments** → approve `mayan-production`.
4. The VM runner downloads those exact images and Compose configuration, loads the images, and starts project `archeoecm-application`.
5. Container health checks and local/public HTTP checks must pass before the commit is recorded as successful.

A merge alone does not deploy. Each new deployment builds the selected main commit; it does not merely restart old containers. No registry credentials are needed because the images travel through the workflow artifact. Artifacts expire after seven days; VM images are retained for rollback.

## 6. Verify on the VM and browser

```bash
cd ~/ECM_Archeology/deployment/application
export APP_ENV_FILE="$PWD/.env"
export APP_RELEASE="$(cat current-release)"
docker compose -p archeoecm-application -f "releases/$APP_RELEASE/compose.yaml" ps
curl --fail https://archeoecm.cs.uwindsor.ca/api/v1/health
docker compose -p archeoecm-application -f "releases/$APP_RELEASE/compose.yaml" logs --tail=80 api web
```

Open `/portal/`, sign in, browse documents, and refresh a deep link such as `/portal/app`. Confirm the original Mayan interface still works. Health checks do not prove authenticated document operations work.

The access extension is a separate Mayan change: follow [permission-controls.md](permission-controls.md). Until installed, document mutation controls, preview and download remain unavailable in React. This workflow intentionally does not replace your running Mayan image.

## Stop, restart and rollback

Use the exported variables and Compose path from step 6:

```bash
docker compose -p archeoecm-application -f "releases/$APP_RELEASE/compose.yaml" stop
docker compose -p archeoecm-application -f "releases/$APP_RELEASE/compose.yaml" up -d --wait
```

Stopping this project does not stop Mayan. Application containers restart after Docker starts, but rootless Docker and the runner service must also be configured to survive reboot.

Failed updates attempt to restore the previous successful release. A first deployment has no previous release. For manual rollback, list `releases/`, choose a previously successful SHA whose images still exist, export it as `APP_RELEASE`, and run `up -d --wait` using that release's Compose file. Verify health and sign-in, then update `current-release` to that SHA. Do not prune old images until you no longer need their rollback path.

## Troubleshooting and current limits

- **Waiting for approval:** approve the environment in the Actions run.
- **Queued after approval:** runner is offline, busy, or lacks `ecm-deploy`.
- **Port allocated:** inspect `ss` and `docker ps`; do not remove the Mayan project.
- **502:** inspect application `ps` and logs, then Nginx routing to 8082.
- **Login 403:** check the exact HTTPS trusted origin, secure cookies, and `/api/v1/` routing.
- **Upstream sign-in unavailable:** VM containers must reach the Mayan HTTPS hostname with a valid certificate.
- **Read-only controls:** install/verify the access extension; do not bypass permission checks.
- **Restart signs users out:** sessions and upload retry tracking are currently in memory. Run one API worker/replica. A restart invalidates sessions; do not automatically retry an uncertain upload. Shared persistent sessions are a later production-hardening task.
- **Resource limits:** API is capped at 768 MB and gateway at 128 MB. Measure under actual uploads and adjust deliberately. Allow several GB of free disk for image transfer and retained releases.

This is the initial university pilot deployment, not a high-availability release. Off-VM Mayan backups remain a separate responsibility.
