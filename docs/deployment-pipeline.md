# Mayan production deployment runbook

This runbook is for the project owner or an approved operator deploying the
Mayan EDMS instance at [archeoecm.cs.uwindsor.ca](https://archeoecm.cs.uwindsor.ca).
Follow the steps in order. Merging code into `main` does **not** deploy Mayan.

## What the pipeline changes

The GitHub Actions workflow is
[**Deploy Mayan to university VM**](../.github/workflows/deploy-mayan.yml). It
manually validates or redeploys the Docker Compose stack already on the VM. It
pulls the configured container images, applies Compose, then checks that Mayan
responds locally.

Production files are stored on the VM:

- Compose file: `~/ECM_Archeology/deployment/mayan/docker-compose.yml`
- Secrets and image settings: `~/ECM_Archeology/deployment/mayan/.env`
- Docker project name: `archeoecm`
- Local health check: `http://127.0.0.1:8080/`
- Public site: `https://archeoecm.cs.uwindsor.ca`

The workflow explicitly uses `docker compose -p archeoecm`. Keep this project
name: it selects the existing production containers and persistent volumes. The
Compose example under `infra/mayan/` is for local development; it is not the
production Compose file. The workflow does not copy application code or Compose
from GitHub to the VM, and it does not deploy a custom Java/React application.

## Change and review policy

`main` is protected for pull-request changes. Create a feature branch, open a PR
to `main`, review the diff, and wait for the **CI / Validate repository and
Mayan Compose** check to pass before merging. CI runs on a GitHub-hosted runner.
Do not push directly to `main`.

The deployment workflow is separate and manual. A PR merge alone never starts
a production deployment.

## Deploy procedure

1. **Start the VM runner.** SSH to the VM and keep this terminal open:

   ```bash
   ssh parmar7f@archeoecm.cs.uwindsor.ca
   cd ~/actions-runner
   ./run.sh
   ```

   Confirm `Listening for Jobs` in the terminal and that
   **Settings → Actions → Runners** lists `archeoecm-runner` as **Idle**. The
   runner must have the `ecm-deploy` label. Pull-request CI does not use this
   runner.

2. **Run the preflight.** In GitHub, open **Actions → Deploy Mayan to university
   VM → Run workflow**. Select branch `main` and operation `validate`, then run
   it. Confirm **Validate production setup** succeeds. This checks rootless
   Docker and validates the VM Compose file and `.env` without displaying
   resolved secrets. It does not change services.

3. **Request deployment.** Start the same workflow from `main`, but choose
   operation `deploy`. Wait for preflight to pass. The **Deploy Mayan after
   approval** job then pauses at the `mayan-production` environment gate. This
   pause is expected.

4. **Approve production.** Open **Review deployments**, select
   `mayan-production`, review the target, and click **Approve and deploy**. The
   configured approver is the repository owner. Self-review is enabled for this
   workflow because the owner may start and approve their own deployment; admin
   bypass is disabled. Approval permits the job to pull images and apply
   Compose, which may briefly restart Mayan.

5. **Verify success.** Wait for both jobs to show green. The deployment log
   should show the `archeoecm-*` containers running and the message `Mayan is
   responding on the VM.` Then perform the VM checks below and open the public
   URL in a browser.

6. **Stop the runner when finished.** In the runner terminal, press `Ctrl+C`.
   The interactive runner stops when its SSH session ends; start it again for
   the next workflow run.

## Verify on the VM

Run these read-only checks over SSH:

```bash
cd ~/ECM_Archeology/deployment/mayan
docker context show
docker compose -p archeoecm -f docker-compose.yml ps
curl --max-time 5 -sS -o /dev/null -w 'Local Mayan HTTP status: %{http_code}\n' http://127.0.0.1:8080/
```

Expected results: Docker context is `rootless`; the `archeoecm` services are
`Up` (the supporting services should be healthy); and the HTTP status is `200`
or `302`. A `302` is an HTTP redirect and is expected for the Mayan sign-in
flow. Also confirm the public HTTPS site loads.

The deployment was verified on **October 23, 2026**. The workflow run completed
successfully, showed `archeoecm-*` services running, and passed the local Mayan
response check: [GitHub Actions run](https://github.com/Rinil-Parmar/heritage-ecm/actions/runs/40013187571).

## One-time cleanup from the failed first test

The first deployment attempt used the default Compose project name `mayan` and
left a duplicate set of containers. The corrected workflow uses `archeoecm`.
Check for leftovers with:

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'archeoecm-|mayan-'
```

If the failed `mayan-*` project is still present, remove only its containers and
network from the production Compose directory:

```bash
cd ~/ECM_Archeology/deployment/mayan
docker compose -p mayan -f docker-compose.yml down
```

Do not add `-v`; that would delete the duplicate project's volumes. This command
targets project `mayan`, not the live `archeoecm` project. Re-run the verification
commands afterward.

## Troubleshooting and recovery

| Symptom | Check or action |
| --- | --- |
| Workflow waits for a runner | From `~/actions-runner`, run `./run.sh` and keep the SSH session open. Confirm `archeoecm-runner` is online and has label `ecm-deploy`. |
| Workflow waits for approval | This is the production gate. An authorized reviewer approves `mayan-production` from the run's **Review deployments** prompt. |
| `port is already allocated` on `127.0.0.1:8080` | Confirm every workflow Compose command uses `-p archeoecm`. Check `docker ps --filter publish=8080`. Do not stop the live `archeoecm-app-1` to make room for a duplicate stack. |
| Mayan health check fails | Run `docker compose -p archeoecm -f docker-compose.yml ps` and `docker compose -p archeoecm -f docker-compose.yml logs --tail=100 app`. Check the workflow logs for the failing step. |
| Local HTTP works but public site does not | The container is responding locally; investigate the VM's Nginx/reverse-proxy and TLS path with the VM administrator. Keep Docker bound to localhost. |
| Need to return to a previous image | There is no automated rollback in this workflow. Use the previously validated Compose configuration and image reference, then redeploy through the same manual workflow and approval gate. Preserve the `archeoecm` project name and volumes. If an upgrade migrated the database, do not assume an image downgrade is safe; follow Mayan's supported recovery procedure and restore from a verified backup if needed. |

Do not paste `.env` values into GitHub, issues, or chat. Review logs before
sharing them because they can contain sensitive operational data. Never commit
uploaded documents, database contents, volume data, or backups. Do not run
`docker compose down -v` against production. This workflow is not a backup
system; off-VM backup and restore have not yet been configured and verified.
Complete and test that procedure before relying on the service for irreplaceable
records or upgrading its data format.

## GitHub settings to maintain

The working VM Compose file, including the verified HTTPS login fix, is recorded
under [infra/mayan/production](../infra/mayan/production/README.md). Its example
environment contains placeholders only. This workflow still uses the file
already on the VM; it does not check out or install the repository copy. Follow
that directory's review and file-update instructions for future changes.

- Protect `main` so changes arrive through pull requests; require the CI check
  to pass before merging where repository rules permit.
- In **Settings → Environments → mayan-production**, restrict deployments to
  `main`, require repository-owner approval, keep self-review enabled if the
  owner is the selected approver, and keep administrator bypass disabled.
- Keep the `ecm-deploy` self-hosted runner online only when a workflow needs it.
