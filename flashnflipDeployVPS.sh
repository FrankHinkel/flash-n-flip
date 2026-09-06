#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
EXPECTED_REMOTE_URL="git@github.com:FrankHinkel/flash-n-flip.git"

dry_run=false
assume_yes=false
skip_release_check=false

usage() {
  cat <<'USAGE'
Flash-n-Flip auf den Produktions-VPS ausrollen.

Verwendung:
  ./flashnflipDeployVPS.sh [OPTIONEN]

Optionen:
  --dry-run             Deploymentplan anzeigen, ohne Netzwerkzugriff oder Änderungen
  --yes                 Sicherheitsabfrage überspringen
  --skip-release-check  Bekannte Release-Blocker bewusst übergehen
  -h, --help            Diese Hilfe anzeigen

Konfiguration (Umgebungsvariable oder gleichnamiger Eintrag in .env):
  FNF_SSH_HOST          SSH-Host (Standard: flash-n-flip.com)
  FNF_SSH_USER          SSH-Benutzer (Standard: deploy)
  FNF_SSH_PORT          SSH-Port (Standard: 22)
  FNF_REMOTE_DIR        Server-Verzeichnis
                        (Standard: /opt/Anwendungen/flash-n-flip.com)
  FNF_DEPLOY_BRANCH     freizugebender Branch (Standard: main)
  FNF_PRODUCTION_DOMAIN öffentliche Domain (Standard: flash-n-flip.com)

Ein echtes Deployment akzeptiert nur einen sauberen Arbeitsstand, dessen
Commit bereits exakt auf origin/FNF_DEPLOY_BRANCH liegt. Produktions-Secrets
bleiben ausschließlich auf dem Server.
USAGE
}

fail() {
  printf 'FEHLER: %s\n' "$*" >&2
  exit 1
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

while (( $# > 0 )); do
  case "$1" in
    --dry-run)
      dry_run=true
      ;;
    --yes)
      assume_yes=true
      ;;
    --skip-release-check)
      skip_release_check=true
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      printf 'Unbekannte Option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

ssh_host="${FNF_SSH_HOST:-$(env_file_value FNF_SSH_HOST)}"
ssh_user="${FNF_SSH_USER:-$(env_file_value FNF_SSH_USER)}"
ssh_port="${FNF_SSH_PORT:-$(env_file_value FNF_SSH_PORT)}"
remote_dir="${FNF_REMOTE_DIR:-$(env_file_value FNF_REMOTE_DIR)}"
deploy_branch="${FNF_DEPLOY_BRANCH:-$(env_file_value FNF_DEPLOY_BRANCH)}"
production_domain="${FNF_PRODUCTION_DOMAIN:-$(env_file_value FNF_PRODUCTION_DOMAIN)}"

ssh_host="${ssh_host:-flash-n-flip.com}"
ssh_user="${ssh_user:-deploy}"
ssh_port="${ssh_port:-22}"
remote_dir="${remote_dir:-/opt/Anwendungen/flash-n-flip.com}"
deploy_branch="${deploy_branch:-main}"
production_domain="${production_domain:-flash-n-flip.com}"

[[ "$ssh_host" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Ungültiger SSH-Host."
[[ "$ssh_user" =~ ^[A-Za-z0-9._-]+$ ]] || fail "Ungültiger SSH-Benutzer."
[[ "$ssh_port" =~ ^[0-9]+$ ]] || fail "Der SSH-Port muss numerisch sein."
(( ssh_port >= 1 && ssh_port <= 65535 )) || fail "Der SSH-Port muss zwischen 1 und 65535 liegen."
[[ "$remote_dir" =~ ^/[A-Za-z0-9._/-]+$ ]] || fail "Ungültiges Remote-Verzeichnis."
[[ "$deploy_branch" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "Ungültiger Deployment-Branch."
[[ "$production_domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail "Ungültige Produktionsdomain."

cd "$SCRIPT_DIR"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" \
  || fail "Das Skript muss aus dem Flash-n-Flip-Repository gestartet werden."
[[ "$repo_root" == "$SCRIPT_DIR" ]] || fail "Das Skript liegt nicht im Repository-Stamm."

for command_name in git node pnpm ssh scp mktemp; do
  command -v "$command_name" >/dev/null 2>&1 \
    || fail "Benötigtes Kommando nicht gefunden: $command_name"
done

current_branch="$(git branch --show-current)"
source_sha="$(git rev-parse HEAD)"
source_version="$(node -p "require('./package.json').version")"
ssh_target="${ssh_user}@${ssh_host}"
ssh_options=(
  -p "$ssh_port"
  -o ServerAliveInterval=20
  -o ServerAliveCountMax=30
)
scp_options=(
  -P "$ssh_port"
  -o ServerAliveInterval=20
  -o ServerAliveCountMax=30
)

printf 'Flash-n-Flip VPS-Deployment\n'
printf '  Quelle:  %s (%s)\n' "$deploy_branch" "$source_sha"
printf '  Version: %s\n' "$source_version"
printf '  Ziel:    %s:%s\n' "$ssh_target" "$remote_dir"
printf '  Domain:  https://%s\n' "$production_domain"

if [[ "$dry_run" == true ]]; then
  printf '\nDRY RUN – es werden weder Netzwerkzugriffe noch Änderungen ausgeführt.\n'
  if [[ "$current_branch" != "$deploy_branch" ]]; then
    printf 'HINWEIS: Aktueller Branch %s entspricht nicht %s.\n' "$current_branch" "$deploy_branch"
  fi
  if [[ -n "$(git status --porcelain)" ]]; then
    printf 'HINWEIS: Der Arbeitsstand ist nicht sauber und würde abgewiesen.\n'
  fi
  cat <<'PLAN'

Geplanter Ablauf:
  1. lokalen Commit, Branch, Version und origin-Synchronität prüfen
PLAN
  if [[ "$skip_release_check" == true ]]; then
    printf '  2. Release-Readiness-Prüfung bewusst überspringen\n'
  else
    printf '  2. Release-Readiness-Prüfung ausführen\n'
  fi
  cat <<'PLAN'
  3. Serverkonfiguration prüfen
  4. veraltete Transfer-Bundles, ungenutzten Build-Cache und dangling Images bereinigen
  5. das gemeinsame Rendezvous-API/Web-Image bauen
  6. Container aktualisieren und auf gesunden Zustand warten
  7. API-Rolle, STUN sowie Bootstrap- und PWA-Routen prüfen
  8. stillgelegte private API-Endpunkte auf HTTP 404 prüfen
  9. erfolgreichen Commit und Version auf dem VPS protokollieren
PLAN
  exit 0
fi

[[ "$current_branch" == "$deploy_branch" ]] \
  || fail "Aktueller Branch ist '$current_branch'; erwartet wird '$deploy_branch'."
[[ -z "$(git status --porcelain)" ]] \
  || fail "Der Arbeitsstand ist nicht sauber. Bitte Änderungen zuerst committen."

pnpm version:check

origin_url="$(git remote get-url origin)"
[[ "$origin_url" == "$EXPECTED_REMOTE_URL" ]] \
  || fail "Unerwartetes origin: $origin_url"

printf '\nPrüfe den veröffentlichten Git-Stand …\n'
git fetch --quiet origin "$deploy_branch"
remote_sha="$(git rev-parse "refs/remotes/origin/$deploy_branch")"
[[ "$source_sha" == "$remote_sha" ]] \
  || fail "HEAD ist nicht identisch mit origin/$deploy_branch. Bitte zuerst committen und pushen."

if [[ "$skip_release_check" == false ]]; then
  printf '\nFühre Release-Readiness-Prüfung aus …\n'
  pnpm release:check
else
  printf '\nWARNUNG: Release-Readiness-Prüfung wurde ausdrücklich übersprungen.\n' >&2
fi

if [[ "$assume_yes" == false ]]; then
  printf '\nZum Deployment von %s auf %s exakt DEPLOY eingeben: ' "$source_version" "$ssh_target"
  read -r confirmation
  [[ "$confirmation" == "DEPLOY" ]] || fail "Deployment abgebrochen."
fi

local_bundle="$(mktemp "${TMPDIR:-/tmp}/flash-n-flip-${source_sha:0:12}.XXXXXX.bundle")"
remote_bundle="$remote_dir/deployments/incoming-$source_sha.bundle"
cleanup_local_bundle() {
  rm -f -- "$local_bundle"
}
trap cleanup_local_bundle EXIT

git bundle create "$local_bundle" "refs/heads/$deploy_branch"
git bundle verify "$local_bundle" >/dev/null

printf '\nÜbertrage den geprüften Git-Stand …\n'
ssh "${ssh_options[@]}" "$ssh_target" mkdir -p -- "$remote_dir/deployments"
scp -q "${scp_options[@]}" "$local_bundle" "$ssh_target:$remote_bundle"

printf '\nStarte serverseitiges Deployment …\n'
ssh "${ssh_options[@]}" "$ssh_target" \
  bash -s -- "$remote_dir" "$deploy_branch" "$source_sha" "$source_version" "$production_domain" "$remote_bundle" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

remote_dir="$1"
deploy_branch="$2"
expected_sha="$3"
expected_version="$4"
production_domain="$5"
source_bundle="$6"
repo_dir="$remote_dir/repo"
compose_dir="$repo_dir/deploy/production"
secrets_dir="$remote_dir/secrets"
backups_dir="$remote_dir/backups"
deployments_dir="$remote_dir/deployments"
production_env="$secrets_dir/production.env"

remote_fail() {
  printf 'SERVER-FEHLER: %s\n' "$*" >&2
  exit 1
}

on_error() {
  exit_code=$?
  if [[ -n "$source_bundle" ]]; then
    rm -f -- "$source_bundle"
  fi
  printf '\nDeployment fehlgeschlagen (Exit %s).\n' "$exit_code" >&2
  if [[ -d "$compose_dir" ]]; then
    (
      cd "$compose_dir"
      docker compose ps >&2 || true
      docker compose logs --tail=120 api web caddy >&2 || true
    )
  fi
  printf 'Der zuvor betriebene private Datenspeicher wird von diesem Release nicht eingebunden.\n' >&2
  exit "$exit_code"
}
trap on_error ERR

for command_name in git docker curl awk find; do
  command -v "$command_name" >/dev/null 2>&1 \
    || remote_fail "Benötigtes Kommando nicht gefunden: $command_name"
done
docker compose version >/dev/null 2>&1 \
  || remote_fail "Docker Compose v2 ist nicht verfügbar."

[[ -d "$repo_dir/.git" ]] || remote_fail "Repository fehlt: $repo_dir"
[[ -f "$production_env" ]] || remote_fail "Produktionskonfiguration fehlt: $production_env"
[[ -f "$source_bundle" ]] || remote_fail "Übertragenes Git-Bundle fehlt: $source_bundle"
[[ -z "$(git -C "$repo_dir" status --porcelain)" ]] \
  || remote_fail "Das Server-Repository enthält lokale Änderungen."

mkdir -p "$deployments_dir"

git -C "$repo_dir" bundle verify "$source_bundle" >/dev/null
bundle_branch_sha="$(
  git -C "$repo_dir" bundle list-heads "$source_bundle" "refs/heads/$deploy_branch" |
    awk 'NR == 1 { print $1 }'
)"
[[ "$bundle_branch_sha" == "$expected_sha" ]] \
  || remote_fail "Das Git-Bundle enthält nicht den freigegebenen Branch-Commit."
git -C "$repo_dir" fetch --quiet "$source_bundle" "refs/heads/$deploy_branch"
resolved_sha="$(git -C "$repo_dir" rev-parse "$expected_sha^{commit}")"
[[ "$resolved_sha" == "$expected_sha" ]] \
  || remote_fail "Der freigegebene Commit ist auf dem Server nicht verfügbar."
rm -f -- "$source_bundle"
source_bundle=""

printf '\nBereinige entbehrliche VPS-Artefakte …\n'
find "$deployments_dir" -maxdepth 1 -type f -name 'incoming-*.bundle' -delete
docker builder prune --force --filter 'until=168h' </dev/null
docker image prune --force </dev/null

previous_sha="$(git -C "$repo_dir" rev-parse HEAD)"
git -C "$repo_dir" switch --detach "$expected_sha"
actual_version="$(awk -F'"' '/"version":/ { print $4; exit }' "$repo_dir/package.json")"
[[ "$actual_version" == "$expected_version" ]] \
  || remote_fail "Version $actual_version stimmt nicht mit $expected_version überein."

cd "$compose_dir"
export FNF_API_IMAGE="flash-n-flip-rendezvous:$expected_version"
export FNF_WEB_IMAGE="flash-n-flip-web:$expected_version"
# Compose env_file supplies runtime values, not build interpolation.
# Select the protected file for both, without sourcing it as shell code.
export COMPOSE_ENV_FILES="$production_env"

docker compose config --quiet </dev/null
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose build api web </dev/null
docker compose up -d --remove-orphans --wait </dev/null

docker compose exec -T api node -e \
  "fetch('http://127.0.0.1:4000/health').then(async response=>{const body=await response.text();console.log(response.status,body);if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))" \
  </dev/null

docker compose exec -T api \
  node /app/scripts/probe-stun-only.mjs stun 3478 \
  </dev/null

pwa_probe="$(curl --silent --show-error --output /dev/null --write-out '%{http_code} %{redirect_url}' \
  "https://$production_domain/pwa")"
[[ "$pwa_probe" == "307 https://$production_domain/app" ]] \
  || remote_fail "Explizite PWA-Route liefert '$pwa_probe' statt '307 https://$production_domain/app'."

root_probe="$(curl --silent --show-error --output /dev/null --write-out '%{http_code} %{redirect_url}' \
  "https://$production_domain/")"
[[ "$root_probe" == "307 https://$production_domain/pwa" ]] \
  || remote_fail "Öffentlicher Start liefert '$root_probe' statt der PWA-Route."

app_probe="$(curl --silent --show-error --output /dev/null --write-out '%{http_code} %{redirect_url}' \
  "https://$production_domain/app")"
[[ "$app_probe" == "307 https://$production_domain/pwa" ]] \
  || remote_fail "Frischer App-Aufruf liefert '$app_probe' statt der PWA-Route."

private_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  "https://$production_domain/api/community/decks")"
[[ "$private_status" == "404" ]] \
  || remote_fail "Stillgelegter Community-Endpunkt antwortet mit HTTP $private_status statt 404."

registration_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --request POST \
  --header 'content-type: application/json' \
  --data '{"email":"deployment-check@example.invalid","password":"not-a-real-password","displayName":"Deployment Check","locale":"de","deviceName":"deployment-check","termsVersion":"check","privacyVersion":"check"}' \
  "https://$production_domain/api/auth/register")"
[[ "$registration_status" == "404" ]] \
  || remote_fail "Stillgelegter Registrierungsendpunkt antwortet mit HTTP $registration_status statt 404."

metadata_file="$deployments_dir/last-successful"
{
  printf 'deployed_at=%s\n' "$timestamp"
  printf 'version=%s\n' "$expected_version"
  printf 'commit=%s\n' "$expected_sha"
  printf 'previous_commit=%s\n' "$previous_sha"
} > "$metadata_file"

trap - ERR
printf '\nDeployment erfolgreich.\n'
printf 'Version: %s\n' "$expected_version"
printf 'Commit:  %s\n' "$expected_sha"
REMOTE_SCRIPT

printf '\nFlash-n-Flip %s wurde erfolgreich auf https://%s ausgerollt.\n' \
  "$source_version" "$production_domain"
