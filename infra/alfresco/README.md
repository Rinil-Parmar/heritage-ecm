# Local Alfresco trial

Status (2026-10-13): local trial discontinued at the user's request due to laptop
resource pressure. Retain these files as a reference; use the university server
for the next deployment. Login, uploads, versioning, and restart persistence were
not validated. The server configuration must restore search and transforms and
be reviewed for server access, credentials, capacity, and backups.

Experimental reduced configuration for a laptop with 8 GB RAM and approximately
3.7 GB available to Docker. This is not the full project deployment or a supported
capacity recommendation. Container memory limits total 3308 MiB, leaving little
headroom. Start with tiny synthetic files and monitor Docker memory.

## Included and omitted

Alfresco Community 26.2.0, Share 26.2.2, PostgreSQL 17.9, and ActiveMQ
6.2.9-jre17-rockylinux8 are pinned from the official Community Compose example.
Named volumes preserve database, content, and messaging data across recreation.
Only repository and Share ports are exposed, bound to laptop loopback.

Search indexing and transforms are disabled. Full-text search, generated previews,
thumbnails, and search-dependent UI features are unavailable or incomplete.
This configuration cannot pass the project's search acceptance criteria.
The bundled upstream development metadata keystore is retained; this setup is
for local synthetic data only. A server deployment needs its own reviewed setup.

## Setup (PowerShell)

From the repository root:

```powershell
cd infra/alfresco
Copy-Item .env.example .env
# Replace placeholder values in .env before starting.
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail 100 alfresco share
```

Do not overwrite an existing .env: its values must match the initialized database.
Do not commit .env or print resolved Compose configuration containing passwords.

## Access

- Share: http://localhost:8081/share/
- Repository API: http://localhost:8080/alfresco/
- Fresh upstream installation starts with the local demo login `admin` / `admin`.
  Change it in the UI before adding real content.

## Stop and resume

```powershell
docker compose stop
docker compose start
```

Never use `down -v` unless deliberately discarding all trial data. Named volumes
are persistence, not backups. Back up the database and content together before
upgrades or migration. No backup/restore procedure has been validated yet.

## Validation

Check container health, login, upload/retrieve a synthetic document, and check
version history. Restart and verify the document still exists. Record measured
results and limitations here after the trial.

## Sources

- https://github.com/Alfresco/acs-deployment/blob/master/docker-compose/community-compose.yaml
- https://github.com/Alfresco/alfresco-community-repo/blob/master/repository/src/main/resources/alfresco/repository.properties
- https://github.com/Alfresco/acs-packaging/blob/master/docs/custom-transforms-and-renditions.md

Consulted 2026-10-13. This project configuration is an adaptation, not an upstream
supported low-memory distribution.
