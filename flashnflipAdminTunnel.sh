#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Verwendung:
  ./flashnflipAdminTunnel.sh [SSH-HOST] [SSH-BENUTZER] [LOKALER-PORT]

Ohne Argumente gelten die Werte aus .env oder:
  SSH-Ziel deploy@flash-n-flip.com, lokaler/entfernter Port 3001,
  Remote-Verzeichnis /opt/Anwendungen/flash-n-flip.com

Für die lokale Entwicklungsumgebung statt dieses Remote-Tunnels verwenden:
  ./flashnflipAdminAccess.sh
USAGE
  exit 0
fi

env_file_value() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  awk -v key="$key" '
    index($0, key "=") == 1 {
      value = substr($0, length(key) + 2)
      gsub(/\r$/, "", value)
      gsub(/^"|"$/, "", value)
      print value
      exit
    }
  ' "$ENV_FILE"
}

ssh_host="${1:-${FNF_SSH_HOST:-$(env_file_value FNF_SSH_HOST)}}"
ssh_user="${2:-${FNF_SSH_USER:-$(env_file_value FNF_SSH_USER)}}"
local_port="${3:-${FNF_ADMIN_LOCAL_PORT:-$(env_file_value FNF_ADMIN_LOCAL_PORT)}}"
remote_port="${FNF_ADMIN_PORT:-$(env_file_value FNF_ADMIN_PORT)}"
remote_dir="${FNF_REMOTE_DIR:-$(env_file_value FNF_REMOTE_DIR)}"

ssh_host="${ssh_host:-flash-n-flip.com}"
ssh_user="${ssh_user:-deploy}"
local_port="${local_port:-3011}"
remote_port="${remote_port:-3001}"
remote_dir="${remote_dir:-/opt/Anwendungen/flash-n-flip.com}"

if [[ ! "$ssh_host" =~ ^[A-Za-z0-9._-]+$ || ! "$ssh_user" =~ ^[A-Za-z0-9._-]+$ ]]; then
  printf 'Ungültiger SSH-Host oder Benutzer.\n' >&2
  exit 2
fi
if [[ "$ssh_host" == "localhost" || "$ssh_host" == "127.0.0.1" || "$ssh_host" == "::1" ]]; then
  printf 'Das Tunnel-Skript erwartet den Produktionshost flash-n-flip.com, nicht localhost.\n' >&2
  printf 'Lokal bitte ./flashnflipAdminAccess.sh verwenden.\n' >&2
  exit 2
fi
if [[ ! "$local_port" =~ ^[0-9]+$ || ! "$remote_port" =~ ^[0-9]+$ ]] \
  || (( local_port < 1024 || local_port > 65535 || remote_port < 1024 || remote_port > 65535 )); then
  printf 'Admin-Ports müssen zwischen 1024 und 65535 liegen.\n' >&2
  exit 2
fi
if [[ ! "$remote_dir" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
  printf 'Ungültiges Remote-Verzeichnis.\n' >&2
  exit 2
fi

target="${ssh_user}@${ssh_host}"
target_id="$(printf '%s' "${target}:${remote_port}" | cksum | awk '{ print $1 }')"
state_dir="/tmp/flash-n-flip-admin-$(id -u)-${local_port}-${target_id}"
control_socket="$state_dir/control"
expected_forward="127.0.0.1:${local_port}:127.0.0.1:${remote_port}"

cleanup() {
  ssh -S "$control_socket" -O exit "$target" >/dev/null 2>&1 || true
  rm -f "$control_socket" >/dev/null 2>&1 || true
  rmdir "$state_dir" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

mkdir -p "$state_dir"
chmod 700 "$state_dir"

existing_tunnel=false
if [[ -S "$control_socket" ]] && ssh -S "$control_socket" -O check "$target" >/dev/null 2>&1; then
  existing_tunnel=true
else
  rm -f "$control_socket"
fi

listener_pids="$(
  { lsof -nP -tiTCP:"$local_port" -sTCP:LISTEN 2>/dev/null || true; } \
    | awk '!seen[$0]++'
)"

if [[ "$existing_tunnel" == false && -n "$listener_pids" ]]; then
  listener_count="$(printf '%s\n' "$listener_pids" | awk 'NF { count += 1 } END { print count + 0 }')"
  listener_pid="$listener_pids"
  listener_ppid=""
  listener_command=""
  if [[ "$listener_count" == "1" ]]; then
    listener_ppid="$(ps -p "$listener_pid" -o ppid= 2>/dev/null | tr -d '[:space:]')"
    listener_command="$(ps -p "$listener_pid" -o command= 2>/dev/null || true)"
  fi

  if [[
    "$listener_count" == "1"
    && "$listener_ppid" == "1"
    && "$listener_command" == ssh\ *
    && " $listener_command " == *" -M "*
    && " $listener_command " == *" -L $expected_forward "*
    && " $listener_command " == *" $target "*
  ]]; then
    printf 'Verwaisten Flash-n-Flip-Admin-Tunnel (PID %s) gefunden; ersetze ihn.\n' "$listener_pid"
    kill -TERM "$listener_pid"
    for _ in {1..30}; do
      if ! lsof -nP -iTCP:"$local_port" -sTCP:LISTEN >/dev/null 2>&1; then
        break
      fi
      sleep 0.1
    done
  else
    printf 'Lokaler Port %s wird bereits von einem anderen Prozess verwendet.\n' "$local_port" >&2
    printf 'Belegung prüfen: lsof -nP -iTCP:%s -sTCP:LISTEN\n' "$local_port" >&2
    exit 1
  fi
fi

if [[ "$existing_tunnel" == false ]]; then
  if lsof -nP -iTCP:"$local_port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf 'Der verwaiste Tunnel auf Port %s konnte nicht beendet werden.\n' "$local_port" >&2
    exit 1
  fi
  ssh \
    -M \
    -S "$control_socket" \
    -o ExitOnForwardFailure=yes \
    -fNT \
    -L "$expected_forward" \
    "$target"
else
  printf 'Bereits laufender Flash-n-Flip-Admin-Tunnel wird wiederverwendet.\n'
fi

access_password="$(
  ssh -S "$control_socket" "$target" \
    "cd '$remote_dir/repo/deploy/production' && \
      docker compose exec -T api /app/flashnflipAdminAccess.sh show"
)"
if (( ${#access_password} < 32 )); then
  printf 'Das gelieferte Admin-Zugangspasswort ist ungültig.\n' >&2
  exit 1
fi

admin_url="http://127.0.0.1:${local_port}/"
printf 'SSH-Ziel: %s\n' "$target"
printf 'Flash-n-Flip-Administration: %s\n' "$admin_url"
printf 'Zugangspasswort: %s\n\n' "$access_password"
printf 'Der Tunnel bleibt bis Enter oder Strg+C geöffnet.\n'

if command -v open >/dev/null 2>&1; then
  open "$admin_url"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$admin_url"
fi

read -r _
