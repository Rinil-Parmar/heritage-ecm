#!/usr/bin/env bash
set -Eeuo pipefail

release="${1:?Commit SHA required}"
bundle="${2:?Bundle directory required}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid release SHA'; exit 1; }
root="$HOME/ECM_Archeology/deployment/application"
export APP_ENV_FILE="$root/.env"
export APP_RELEASE="$release"
test -r "$APP_ENV_FILE" || { echo "Create $APP_ENV_FILE first; see the application deployment guide."; exit 1; }
[[ "$(docker context show)" == rootless ]]
docker info --format '{{json .SecurityOptions}}' | grep -q rootless
mkdir -p "$root/releases/$release"
# Protect against another manual deployment as well as workflow concurrency.
exec 9>"$root/deployment.lock"
flock -n 9 || { echo 'Another application deployment is running.'; exit 1; }
previous=''
if [[ -f "$root/current-release" ]]; then previous="$(cat "$root/current-release")"; fi
if [[ -n "$previous" ]]; then
  [[ "$previous" =~ ^[0-9a-f]{40}$ ]]
  test -f "$root/releases/$previous/compose.yaml"
fi
cp "$bundle/compose.yaml" "$root/releases/$release/compose.yaml"
compose="$root/releases/$release/compose.yaml"
docker compose -p archeoecm-application -f "$compose" config --quiet
gzip -dc "$bundle/images.tar.gz" | docker load

rollback() {
  trap - ERR
  echo 'Deployment failed; this release is not marked successful.'
  if [[ -n "$previous" && "$previous" != "$release" ]]; then
    export APP_RELEASE="$previous"
    docker compose -p archeoecm-application -f "$root/releases/$previous/compose.yaml" up -d --wait --wait-timeout 180 || echo 'Rollback also failed; inspect application containers.'
  else
    echo 'No different previous release to restore. Existing Mayan stack was not modified.'
  fi
  exit 1
}
trap rollback ERR
docker compose -p archeoecm-application -f "$compose" up -d --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:8082/api/v1/health
curl --fail --silent --show-error --max-time 15 --output /dev/null http://127.0.0.1:8082/portal/
curl --fail --silent --show-error --max-time 15 https://archeoecm.cs.uwindsor.ca/api/v1/health
curl --fail --silent --show-error --max-time 15 --output /dev/null https://archeoecm.cs.uwindsor.ca/portal/
printf '%s\n' "$release" > "$root/current-release.tmp"
mv "$root/current-release.tmp" "$root/current-release"
echo "Application deployed: $release"
