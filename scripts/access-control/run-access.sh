#!/usr/bin/env bash
set -euo pipefail

mode="${1:-plan}"
case "$mode" in inventory|plan|apply|verify) ;; *) echo 'Use inventory, plan, apply, or verify.' >&2; exit 2 ;; esac
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
deployment_dir="${ECM_DEPLOYMENT_DIR:-$HOME/ECM_Archeology/deployment/mayan}"
cd "$deployment_dir"
compose=(docker --context rootless compose -p archeoecm -f docker-compose.yml)
# Stream bytes instead of using docker cp: university UID/GID values can fall
# outside rootless Docker's subordinate-ID mappings. Files are created by the
# same container user that executes the management command.
container_dir="$("${compose[@]}" exec -T app mktemp -d /tmp/ecm-access.XXXXXXXX)"
[[ "$container_dir" =~ ^/tmp/ecm-access\.[[:alnum:]]+$ ]] || { echo 'Unexpected temporary path' >&2; exit 1; }
cleanup() {
  "${compose[@]}" exec -T app sh -c 'rm -f -- "$1/configure_access.py" "$1/roles.json"; rmdir -- "$1"' sh "$container_dir" || true
}
trap cleanup EXIT
"${compose[@]}" exec -T app sh -c 'umask 077; cat > "$1/configure_access.py"' sh "$container_dir" < "$script_dir/configure_access.py"
"${compose[@]}" exec -T app sh -c 'umask 077; cat > "$1/roles.json"' sh "$container_dir" < "$script_dir/roles.json"
"${compose[@]}" exec -T \
  -e "ECM_ACCESS_MODE=$mode" \
  -e "ECM_ACCESS_POLICY=$container_dir/roles.json" \
  -e "ECM_ACCESS_ACTOR=${ECM_ACCESS_ACTOR:-admin}" \
  -e "ECM_ACCESS_BACKUP_CONFIRMED=${ECM_ACCESS_BACKUP_CONFIRMED:-no}" \
  app /opt/mayan-edms/bin/mayan-edms.py shell -c \
  "import runpy; runpy.run_path('$container_dir/configure_access.py', run_name='__main__')"
