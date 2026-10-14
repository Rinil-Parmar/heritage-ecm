# Rootless Docker on the university server

Status: preparation only. Docker Engine and Compose CLIs are installed on Delta,
but the default system socket is absent and system/user Docker services report
inactive. No rootless daemon has been installed or started by this project.

Rootless Docker runs the engine and containers as the logged-in account. It can
be installed without sudo when the host prerequisites already exist. It does
not bypass university resource allocations or missing kernel/ID-map support.

## 1. Inspect prerequisites

Run on the Linux server:

```bash
bash scripts/check-rootless-docker.sh
# Optionally inspect an existing local storage directory assigned to you:
bash scripts/check-rootless-docker.sh /path/to/assigned/local/storage
```

Required: functional newuidmap/newgidmap, at least 65536 subordinate IDs for the
account in each of /etc/subuid and /etc/subgid, permitted user namespaces, and
suitable writable local storage. A successful single-UID unshare test alone does
not establish that multi-ID mapping or the Docker daemon will work.

Missing rootless helper binaries may be installed under the user's account.
Missing subordinate allocations, privileged mapping helpers, or host restrictions
may require administrator assistance; do not alter system files or security
settings to work around them.

## 2. Choose data storage before installation

Delta's /home is network-mounted. Docker explicitly excludes NFS for its rootless
data directory. Confirm the filesystem, ownership, quota, retention, and backup
policy of an assigned local scratch/project directory. Do not guess a shared
directory or use temporary storage for persistent project records.

Rootless Docker defaults to ~/.local/share/docker. Before installation, configure
a reviewed local data-root in ~/.config/docker/daemon.json, preserving any existing
settings. Newer Docker/containerd configurations may have additional image storage
paths: inspect the installed version's defaults and ensure those are local too.
Exact paths will be selected after the preflight results are reviewed.

## 3. Install in the account only after prerequisites pass

Prefer the installed dockerd-rootless-setuptool.sh. Its `check` command can provide
additional diagnostics. Its `install` command creates a user service and normally
starts it, so finish storage configuration first.

If helpers are absent, Docker provides https://get.docker.com/rootless for user-local
installation. Download and review the script and its version selection before
running it; do not install a second daemon merely because the existing helper
is not on PATH. The preflight report is needed before selecting this route.

No sudo, system-wide service changes, socket permission changes, or rootful
Docker-in-Docker are part of this plan.

## 4. Validate engine and limits

After installation, inspect the rootless context using `docker context ls`.
Use that context explicitly for project commands. Verify Docker reports rootless
security mode and that its storage directories use the intended local filesystem.
Run a small disposable test container before pulling Alfresco images.

Memory/CPU limits require cgroup v2 with suitable user-systemd delegation. Verify
the actual daemon reports usable controllers and that a test container's limits
take effect before deploying Alfresco on the shared server.

Without enabled user lingering, a user service may not survive logout or reboot.
Do not assume permanent background hosting. Establish session lifecycle support
before relying on the server for the team's shared environment.

## 5. Deploy Alfresco after engine validation

Prepare a separate full server deployment with search and transforms enabled;
the retained laptop compose file is an incomplete experiment. Publish only the
web entry point on loopback and reach it through an SSH tunnel. Keep Docker's API
on the user Unix socket. Agree on a resource budget and storage before starting.

## Official references

- https://docs.docker.com/engine/security/rootless/
- https://docs.docker.com/engine/security/rootless/tips/
- https://docs.docker.com/engine/security/rootless/troubleshoot/

Consulted 2026-10-13. Nothing in this guide has yet been validated on Delta.
