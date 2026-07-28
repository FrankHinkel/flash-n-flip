#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

usage() {
  cat <<'USAGE'
Verwendung:
  ./flashnflipAdminAccess.sh [show]

Kopiert das Zugangspasswort der ausschließlich lokal erreichbaren
Flash-n-Flip-Administration bei direktem Terminalaufruf in die Zwischenablage.
Bei nicht-interaktiver Verwendung wird es unverändert auf stdout ausgegeben.
Fehlt die Passwortdatei, wird sie mit 256 Bit Zufall erzeugt und nur für den
aktuellen Betriebssystembenutzer lesbar gespeichert.
USAGE
}

emit_password() {
  local value="$1"
  if [[ -t 1 ]]; then
    if command -v pbcopy >/dev/null 2>&1; then
      if printf '%s' "$value" | pbcopy; then
        printf 'Admin-Zugangspasswort wurde in die Zwischenablage kopiert.\n' >&2
        return 0
      fi
      printf 'Admin-Zugangspasswort konnte nicht in die Zwischenablage kopiert werden.\n' >&2
      return 1
    fi
    if command -v wl-copy >/dev/null 2>&1; then
      if printf '%s' "$value" | wl-copy; then
        printf 'Admin-Zugangspasswort wurde in die Zwischenablage kopiert.\n' >&2
        return 0
      fi
      printf 'Admin-Zugangspasswort konnte nicht in die Zwischenablage kopiert werden.\n' >&2
      return 1
    fi
    if command -v xclip >/dev/null 2>&1; then
      if printf '%s' "$value" | xclip -selection clipboard; then
        printf 'Admin-Zugangspasswort wurde in die Zwischenablage kopiert.\n' >&2
        return 0
      fi
      printf 'Admin-Zugangspasswort konnte nicht in die Zwischenablage kopiert werden.\n' >&2
      return 1
    fi
    printf 'Keine unterstützte Zwischenablage gefunden; Passwort wird nicht ausgegeben.\n' >&2
    return 1
  fi
  printf '%s' "$value"
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
  emit_password "$configured_password"
  exit 0
fi

password_file="${configured_password_file:-uploads/admin-access-password}"
if [[ "$password_file" != /* ]]; then
  password_file="$PROJECT_ROOT/apps/api/$password_file"
fi

password_directory="$(dirname "$password_file")"

if [[ ! -f "$password_file" ]]; then
  mkdir -p "$password_directory"
  chmod 700 "$password_directory"
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

if [[ -w "$password_file" ]]; then
  chmod 600 "$password_file"
fi
password="$(tr -d '\r\n' <"$password_file")"
if (( ${#password} < 32 )); then
  printf 'Die Admin-Zugangspasswortdatei enthält weniger als 32 Zeichen.\n' >&2
  exit 1
fi
emit_password "$password"
