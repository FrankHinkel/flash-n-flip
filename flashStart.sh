#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
KEEP_DATABASE="${FLASH_KEEP_DB:-0}"
POSTGRES_STARTED=0
GENERATED_SNAPSHOT_DIR=""
GENERATED_FILES=(
  "apps/admin/next-env.d.ts"
  "apps/web/next-env.d.ts"
  "apps/mobile/expo-env.d.ts"
  "apps/mobile/.gitignore"
)

info() {
  printf '\033[1;36m[Flash-n-Flip]\033[0m %s\n' "$1"
}

success() {
  printf '\033[1;32m[Flash-n-Flip]\033[0m %s\n' "$1"
}

fail() {
  printf '\033[1;31m[Flash-n-Flip]\033[0m %s\n' "$1" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Lokale Flash-n-Flip-Entwicklungsumgebung starten.

Verwendung:
  ./flashStart.sh
  ./flashStart.sh --keep-db

Optionen:
  --keep-db  PostgreSQL nach dem Beenden weiterlaufen lassen.
  -h, --help Diese Hilfe anzeigen.

Alternativ:
  FLASH_KEEP_DB=1 ./flashStart.sh
EOF
}

snapshot_generated_files() {
  local relative_path
  local snapshot_path

  GENERATED_SNAPSHOT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/flashcards-start.XXXXXX")"

  for relative_path in "${GENERATED_FILES[@]}"; do
    snapshot_path="$GENERATED_SNAPSHOT_DIR/$relative_path"
    mkdir -p "$(dirname "$snapshot_path")"

    if [[ -f "$relative_path" ]]; then
      cp -p "$relative_path" "$snapshot_path"
    else
      touch "$snapshot_path.missing"
    fi
  done
}

restore_generated_files() {
  local relative_path
  local snapshot_path

  [[ -n "$GENERATED_SNAPSHOT_DIR" ]] || return

  for relative_path in "${GENERATED_FILES[@]}"; do
    snapshot_path="$GENERATED_SNAPSHOT_DIR/$relative_path"

    if [[ -f "$snapshot_path.missing" ]]; then
      rm -f "$relative_path"
    elif [[ -f "$snapshot_path" ]]; then
      cp -p "$snapshot_path" "$relative_path"
    fi
  done

  case "$GENERATED_SNAPSHOT_DIR" in
    "${TMPDIR:-/tmp}"/flashcards-start.*)
      rm -rf "$GENERATED_SNAPSHOT_DIR"
      ;;
  esac

  GENERATED_SNAPSHOT_DIR=""
}

for argument in "$@"; do
  case "$argument" in
    --keep-db)
      KEEP_DATABASE=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unbekannte Option: $argument"
      ;;
  esac
done

cleanup() {
  local exit_code=$?
  trap - EXIT

  restore_generated_files

  if [[ "$POSTGRES_STARTED" -eq 1 && "$KEEP_DATABASE" != "1" ]]; then
    info "Stoppe den von diesem Skript gestarteten PostgreSQL-Container …"
    docker compose stop postgres >/dev/null 2>&1 || true
  fi

  if [[ "$exit_code" -eq 0 ]]; then
    success "Lokale Entwicklungsumgebung beendet."
  else
    printf '\n\033[1;31m[Flash-n-Flip]\033[0m Entwicklungsumgebung wurde mit Status %s beendet.\n' \
      "$exit_code" >&2
    exit "$exit_code"
  fi
}

wait_for_docker() {
  if docker info >/dev/null 2>&1; then
    return
  fi

  if [[ "$(uname -s)" == "Darwin" ]] && [[ -d "/Applications/Docker.app" ]]; then
    info "Docker Desktop wird gestartet …"
    open -a Docker

    for _ in {1..60}; do
      if docker info >/dev/null 2>&1; then
        success "Docker Desktop ist bereit."
        return
      fi
      sleep 1
    done
  fi

  fail "Docker ist nicht erreichbar. Bitte Docker Desktop starten und erneut versuchen."
}

wait_for_postgres() {
  local container_id
  local health_status

  container_id="$(docker compose ps -q postgres)"
  [[ -n "$container_id" ]] || fail "Der PostgreSQL-Container wurde nicht erstellt."

  for _ in {1..60}; do
    health_status="$(
      docker inspect \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
        "$container_id" 2>/dev/null || true
    )"

    case "$health_status" in
      healthy | running)
        success "PostgreSQL ist bereit."
        return
        ;;
      exited | dead)
        fail "PostgreSQL wurde unerwartet beendet. Details: docker compose logs postgres"
        ;;
    esac

    sleep 1
  done

  fail "PostgreSQL wurde nicht innerhalb von 60 Sekunden bereit."
}

cd "$PROJECT_ROOT"

command -v node >/dev/null 2>&1 || fail "Node.js fehlt. Benötigt wird Node.js 22 oder neuer."
command -v pnpm >/dev/null 2>&1 || fail "pnpm fehlt. Installation: corepack enable"
command -v docker >/dev/null 2>&1 || fail "Docker fehlt. Bitte Docker Desktop installieren."

NODE_VERSION="$(node --version)"
NODE_MAJOR="${NODE_VERSION#v}"
NODE_MAJOR="${NODE_MAJOR%%.*}"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || fail "Node.js-Version konnte nicht erkannt werden: $NODE_VERSION"
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Node.js 22 oder neuer wird benötigt. Gefunden: $NODE_VERSION"

if [[ ! -f ".env" ]]; then
  cp ".env.example" ".env"
  info "Lokale .env aus .env.example erstellt."
fi

info "Installiere beziehungsweise prüfe Abhängigkeiten …"
pnpm install --frozen-lockfile --prefer-offline

wait_for_docker

if [[ "$(docker compose ps --status running --services postgres 2>/dev/null || true)" == "postgres" ]]; then
  info "Der vorhandene PostgreSQL-Container wird weiterverwendet."
else
  info "Starte PostgreSQL …"
  docker compose up -d postgres
  POSTGRES_STARTED=1
fi

trap cleanup EXIT
wait_for_postgres

info "Führe Datenbankmigrationen aus …"
pnpm --filter @flashcards/api db:migrate

cat <<'EOF'

Flash-n-Flip startet jetzt im lokalen Entwicklungsmodus:

  Web-App:       http://127.0.0.1:3000
  Administration: http://127.0.0.1:3001
  API:           http://127.0.0.1:4000
  Mobile/Expo:   QR-Code und Optionen erscheinen unten

Die erzeugte .env enthält ausschließlich lokale Entwicklungswerte.
Zum Beenden Strg+C drücken.

EOF

snapshot_generated_files
pnpm dev
