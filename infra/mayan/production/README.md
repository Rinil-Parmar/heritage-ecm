# University VM production Compose

This directory records the working Compose file copied from the university VM
on October 23, 2026, after public HTTPS login was fixed. The Compose file is
unchanged from that copy. Its optional profiles and upstream password fallback
values are retained; use explicit private credentials in the VM environment.

| Item | Value |
| --- | --- |
| Public URL | https://archeoecm.cs.uwindsor.ca |
| VM directory | ~/ECM_Archeology/deployment/mayan |
| Compose project | archeoecm |
| Active services | app, postgresql, rabbitmq, redis |
| Docker | Rootless, owned by the deployment user |
| Nginx upstream | http://127.0.0.1:8080 |

The parent directory's compose.yaml is the separate laptop development setup.
The .env.example here is a template, not an export of the VM's private settings.
For an existing installation, retain the VM's .env, .env-local if present,
profile selection, image settings, credentials, and volume overrides.
Do not replace existing credentials with example values: that does not rotate
passwords already stored by PostgreSQL or RabbitMQ.

## HTTPS login fix

Public login returned HTTP 403 while the same credentials worked over an SSH
tunnel. Nginx already forwarded Host and X-Forwarded-Proto. Mayan had
SECURE_PROXY_SSL_HEADER=None and CSRF_TRUSTED_ORIGINS=[].

The shared x-mayan-container environment now contains:

```yaml
environment:
  <<: [*mayan-environment]
  MAYAN_SECURE_PROXY_SSL_HEADER: '["HTTP_X_FORWARDED_PROTO", "https"]'
  MAYAN_CSRF_TRUSTED_ORIGINS: '["https://archeoecm.cs.uwindsor.ca"]'
```

Keep the environment merge: an app-specific replacement can drop the inherited
database and broker settings. Keep the upstream bound to loopback and have
Nginx overwrite X-Forwarded-Proto with its own $scheme. The owner confirmed
public login succeeded after applying these settings.

## Review and deployment

1. Make configuration changes on a branch, open a PR, pass CI, and merge into
   protected main. Never commit .env, .env-local, keys, documents, or backups.
2. The existing CD workflow does not copy this file from GitHub. It operates on
   the Compose file already in the VM directory. A merge alone does not update
   production. The initial import here already matches the fixed VM file.
3. For future updates, obtain the reviewed file from the intended main commit
   into a separate staging location. Compare it with the VM file and review
   volume names, ports, profiles, and image changes. Back up the current VM
   Compose file and copy only the reviewed Compose file to the live directory.
   Preserve private environment files. This copy does not restart containers;
   it is currently a manual operator step, outside the Actions approval gate.
4. Start the runner and run the manual validate operation from main. Then run
   deploy and approve the mayan-production environment gate. Follow the
   [deployment runbook](../../../docs/deployment-pipeline.md).
5. Verify containers, effective HTTPS settings, and an actual public login.
   HTTP 200 or 302 alone does not verify authentication.

On the VM, after deployment:

```bash
cd ~/ECM_Archeology/deployment/mayan
docker compose -p archeoecm -f docker-compose.yml ps
docker compose -p archeoecm -f docker-compose.yml exec app \
  /opt/mayan-edms/bin/mayan-edms.py shell -c \
  "from django.conf import settings; print(settings.SECURE_PROXY_SSL_HEADER); print(settings.CSRF_TRUSTED_ORIGINS)"
```

Expect the forwarded-protocol header and public HTTPS origin shown above.
Test login at the public URL in a fresh browser session. If login fails, check
the login POST status in Nginx access logs and the app logs before resetting
passwords. Preserve CSRF protection.

## Validation without starting containers

From this directory, using example credentials only:

```bash
MAYAN_DOCKER_ENV_FILE=.env.example docker compose --env-file .env.example -p archeoecm -f docker-compose.yml config --quiet
```

This validates configuration only; it does not start Docker containers.
Inactive optional profiles may produce warnings for their unset variables.
