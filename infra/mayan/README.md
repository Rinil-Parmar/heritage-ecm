# Local Mayan EDMS proof of concept

This is a resource-limited local evaluation based on Mayan EDMS 4.12's official
Docker Compose architecture. It runs the all-in-one Mayan application with
PostgreSQL, RabbitMQ, and Redis. Elasticsearch, Traefik, and extra workers are
omitted. The service is exposed only on laptop loopback.

The configuration is for synthetic development data. It is not a production or
shared deployment. Total container memory limits are approximately 3.4 GB, but
Docker Desktop and WSL add overhead. Monitor the laptop throughout the trial.

The Compose file sets the six Celery worker classes and Gunicorn to one process
each. All queues remain available, but document conversion, OCR, and indexing run
with development-level concurrency. Increase these values only on a larger host.

## Start

Start Docker Desktop and wait for its engine to report ready. From this folder:

```powershell
Copy-Item .env.example .env
# Replace every replace_with_random_* value before first start.
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker stats --no-stream
```

Do not overwrite `.env` after the database has initialized. The local file is
ignored by Git. Do not print `docker compose config` because it resolves secrets.

Open http://localhost:8082/. On first startup, Mayan displays the random password
for the `admin` account. Sign in and change it immediately.

The REST API root is available at http://localhost:8082/api/v4/.

## Stop and resume

```powershell
docker compose stop
docker compose start
```

Stopping preserves data. Quit Docker Desktop after stopping when you want to
release its remaining Windows/WSL resources.

`docker compose down` removes containers but preserves named volumes. Never run
`docker compose down --volumes` unless intentionally deleting all proof-of-concept
data. Named volumes are not backups.

## Initial acceptance check

Use 5-10 small synthetic files only. Verify:

1. Sign-in and admin password change.
2. Upload and retrieve a document.
3. Metadata creation and assignment.
4. Text extraction/search on one small PDF.
5. Upload and retrieve a second version.
6. Reader and contributor permissions.
7. Document link/reference behavior.
8. Stop/start persistence.

Record peak RAM, CPU, image disk usage, and any failed background tasks. Stop the
trial if Windows free memory falls below approximately 1 GB or becomes unstable.

On the initial local smoke test, the healthy stack used about 1.62 GB across all
four containers, including about 1.47 GB for Mayan. Actual use grows during OCR,
conversion, indexing, and concurrent uploads.

## Version policy

The Mayan image uses the official `s4.12` series tag because that is the tag used
by the current upstream Compose configuration. Supporting service versions are
pinned to the versions in that configuration as consulted on 2026-10-14. After a
successful pull, record image digests before using the setup for team deployment.

## Official references

- https://docs.mayan-edms.com/chapters/docker/install_docker_compose.html
- https://docs.mayan-edms.com/chapters/getting_started.html
- https://gitlab.com/mayan-edms/mayan-edms/-/tree/master/docker/
