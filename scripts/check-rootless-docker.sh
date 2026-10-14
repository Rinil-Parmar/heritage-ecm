#!/usr/bin/env bash
# Read-only preflight. Run on the Linux server, not on the Windows laptop.
# Optional argument: an existing proposed local directory for Docker data.
set -u

if [[ $(uname -s) != Linux ]]; then
  printf 'Run this check on the Linux deployment server.\n' >&2
  exit 1
fi

task_user=$(id -un)
task_uid=$(id -u)
printf '\n== Account and kernel ==\n'
id
uname -sr
printf '\n== Rootless prerequisites and tools ==\n'
for task_tool in docker newuidmap newgidmap rootlesskit slirp4netns fuse-overlayfs dockerd-rootless.sh dockerd-rootless-setuptool.sh; do
  command -v "$task_tool" || printf 'Not on PATH: %s\n' "$task_tool"
done
printf '\n== Subordinate ID allocations (need at least 65536 each) ==\n'
for task_file in /etc/subuid /etc/subgid; do
  printf '%s\n' "$task_file"
  if [[ -r $task_file ]]; then
    awk -F: -v user="$task_user" -v uid="$task_uid" '
      $1 == user || $1 == uid {print; found=1}
      END {if (!found) print "No matching allocation"}
    ' "$task_file"
  else
    printf 'Not readable or absent\n'
  fi
done
printf '\n== Unprivileged user namespace test ==\n'
if command -v unshare >/dev/null; then
  unshare --user --map-root-user true && printf 'PASS\n' || printf 'FAILED: inspect the error above\n'
else
  printf 'unshare unavailable; test not performed\n'
fi
printf '\n== User session and resource control ==\n'
printf 'XDG_RUNTIME_DIR=%s\n' "${XDG_RUNTIME_DIR:-unset}"
systemctl --user show-environment >/dev/null 2>&1 && printf 'User systemd manager reachable\n' || printf 'User systemd manager unavailable\n'
loginctl show-user "$task_user" -p Linger 2>&1 || true
stat -fc 'Cgroup filesystem: %T' /sys/fs/cgroup 2>&1 || true
if [[ -r /sys/fs/cgroup/cgroup.controllers ]]; then
  cat /sys/fs/cgroup/cgroup.controllers
fi
printf '\n== Storage ==\n'
findmnt -T "$HOME" -o TARGET,SOURCE,FSTYPE,OPTIONS 2>&1 || true
df -hT "$HOME" 2>&1 || true
if [[ $# -gt 0 ]]; then
  task_storage=$1
  if [[ -d $task_storage ]]; then
    findmnt -T "$task_storage" -o TARGET,SOURCE,FSTYPE,OPTIONS 2>&1 || true
    df -hT "$task_storage" 2>&1 || true
    [[ -w $task_storage ]] && printf 'Proposed directory is writable\n' || printf 'Proposed directory is not writable\n'
  else
    printf 'Proposed directory does not exist: %s\n' "$task_storage"
  fi
fi
printf '\nInspection complete; this is not confirmation that Docker can run.\n'
printf 'No packages, files, services, or host settings were changed.\n'
