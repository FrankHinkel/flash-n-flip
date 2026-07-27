#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

usage() {
  cat <<'USAGE'
Verwendung:
  ./flashnflipAdminAccess.sh [show]

Zeigt das Zugangspasswort der ausschließlich lokal erreichbaren
Flash-n-Flip-Administration an. Fehlt die Passwortdatei, wird sie mit
256 Bit Zufall erzeugt und nur für den aktuellen Betriebssystembenutzer lesbar
gespeichert.
USAGE
}

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

command="${1:-show}"
case "$command" in
  show) ;;
  help | -h | --help)
    usage
    exit 0
    ;;
  *)
    printf 'Unbekannter Befehl: %s\n\n' "$command" >&2
    usage >&2
    exit 2
    ;;
esac

configured_password="${FNF_ADMIN_ACCESS_PASSWORD:-$(env_file_value FNF_ADMIN_ACCESS_PASSWORD)}"
configured_password_file="${FNF_ADMIN_ACCESS_PASSWORD_FILE:-$(env_file_value FNF_ADMIN_ACCESS_PASSWORD_FILE)}"
if [[ -n "$configured_password" && -n "$configured_password_file" ]]; then
  printf 'Nur FNF_ADMIN_ACCESS_PASSWORD oder FNF_ADMIN_ACCESS_PASSWORD_FILE konfigurieren, nicht beide.\n' >&2
  exit 1
fi

if [[ -n "$configured_password" ]]; then
  if (( ${#configured_password} < 32 )); then
    printf 'FNF_ADMIN_ACCESS_PASSWORD muss mindestens 32 Zeichen enthalten.\n' >&2
    exit 1
  fi
  printf '%s' "$configured_password"
  exit 0
fi

password_file="${configured_password_file:-uploads/admin-access-password}"
if [[ "$password_file" != /* ]]; then
  password_file="$PROJECT_ROOT/apps/api/$password_file"
fi

password_directory="$(dirname "$password_file")"
mkdir -p "$password_directory"
chmod 700 "$password_directory"

if [[ ! -f "$password_file" ]]; then
  temporary_file="$(mktemp "$password_directory/.admin-access.XXXXXX")"
  cleanup() {
    rm -f "$temporary_file"
  }
  trap cleanup EXIT
  chmod 600 "$temporary_file"
  node -e \
    'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url") + "\n")' \
    >"$temporary_file"
  if [[ -e "$password_file" ]]; then
    rm -f "$temporary_file"
  else
    mv "$temporary_file" "$password_file"
  fi
  trap - EXIT
fi

chmod 600 "$password_file"
password="$(tr -d '\r\n' <"$password_file")"
if (( ${#password} < 32 )); then
  printf 'Die Admin-Zugangspasswortdatei enthält weniger als 32 Zeichen.\n' >&2
  exit 1
fi
printf '%s' "$password"
