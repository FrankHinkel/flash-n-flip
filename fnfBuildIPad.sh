#!/bin/sh

set -eu

script_root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
project="$script_root/apps/apple/ios/App/App.xcodeproj"
derived_data="$script_root/apps/apple/ios/DerivedData/fnf-ipad"
bundle_identifier="com.flash-n-flip"
configuration="Debug"
launch_app=1
dry_run=0
device_selector=""

usage() {
  cat <<'EOF'
Verwendung:
  ./fnfBuildIPad.sh [Optionen] [iPad-Name|UDID|CoreDevice-ID]

Baut Flash-n-Flip, installiert die App auf einem verbundenen iPad und startet sie.
Ohne Geräteangabe wird genau ein verbundenes iPad automatisch ausgewählt.

Optionen:
  --release      Release statt Debug bauen
  --no-launch    App nach der Installation nicht starten
  --dry-run      Gerät ermitteln und geplante Befehle nur anzeigen
  -h, --help     Diese Hilfe anzeigen

Beispiele:
  ./fnfBuildIPad.sh
  ./fnfBuildIPad.sh "iPad (3)"
  ./fnfBuildIPad.sh --release --no-launch 00008112-001A30C11ADBA01E
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --release)
      configuration="Release"
      ;;
    --no-launch)
      launch_app=0
      ;;
    --dry-run)
      dry_run=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "error: Unbekannte Option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [ -n "$device_selector" ]; then
        echo "error: Bitte nur ein iPad angeben." >&2
        exit 2
      fi
      device_selector=$1
      ;;
  esac
  shift
done

for required_command in node pnpm xcodebuild xcrun; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "error: $required_command ist erforderlich." >&2
    exit 1
  fi
done

if [ ! -f "$project/project.pbxproj" ]; then
  echo "error: Xcode-Projekt nicht gefunden: $project" >&2
  exit 1
fi

devices_json=$(mktemp "${TMPDIR:-/tmp}/fnf-ipad-devices.XXXXXX")
trap 'rm -f "$devices_json"' EXIT HUP INT TERM

echo "Verbundenes iPad wird ermittelt ..."
xcrun devicectl list devices --json-output "$devices_json" --timeout 30 >/dev/null

selected_device=$(
  node - "$devices_json" "$device_selector" <<'NODE'
const fs = require("node:fs");

const [, , jsonPath, selector] = process.argv;
const report = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const devices = (report.result?.devices ?? []).filter(
  (device) =>
    device.hardwareProperties?.deviceType === "iPad" &&
    device.hardwareProperties?.reality === "physical" &&
    device.connectionProperties?.tunnelState === "connected",
);

const matches = selector
  ? devices.filter((device) =>
      [
        device.deviceProperties?.name,
        device.identifier,
        device.hardwareProperties?.udid,
      ].includes(selector),
    )
  : devices;

if (matches.length !== 1) {
  if (matches.length === 0) {
    console.error(
      selector
        ? `error: Kein verbundenes iPad passt zu "${selector}".`
        : "error: Kein verbundenes iPad gefunden. Bitte entsperren, verbinden und den Mac bestätigen.",
    );
  } else {
    console.error("error: Mehrere iPads sind verbunden. Bitte eines als Argument angeben:");
    for (const device of matches) {
      console.error(
        `  ${device.deviceProperties?.name}  ${device.hardwareProperties?.udid}`,
      );
    }
  }
  process.exit(1);
}

const device = matches[0];
const fields = [
  device.hardwareProperties?.udid,
  device.identifier,
  device.deviceProperties?.name,
];
if (fields.some((field) => !field || String(field).includes("\t"))) {
  console.error("error: Das verbundene iPad liefert keine verwendbare Gerätekennung.");
  process.exit(1);
}
console.log(fields.join("\t"));
NODE
)

device_udid=$(printf '%s\n' "$selected_device" | cut -f1)
device_identifier=$(printf '%s\n' "$selected_device" | cut -f2)
device_name=$(printf '%s\n' "$selected_device" | cut -f3-)

echo "Ziel: $device_name ($device_udid)"
echo "Konfiguration: $configuration"

run() {
  printf '+ '
  printf '%s ' "$@"
  printf '\n'
  if [ "$dry_run" -eq 0 ]; then
    "$@"
  fi
}

cd "$script_root"
run pnpm install --frozen-lockfile
# Die Xcode-Buildphase erzeugt und kopiert den signierten Direct Webstack.
run xcodebuild \
  -project "$project" \
  -scheme App \
  -configuration "$configuration" \
  -destination "platform=iOS,id=$device_udid" \
  -derivedDataPath "$derived_data" \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  build

app_path="$derived_data/Build/Products/$configuration-iphoneos/App.app"
if [ "$dry_run" -eq 0 ] && [ ! -d "$app_path" ]; then
  echo "error: Gebaute App nicht gefunden: $app_path" >&2
  exit 1
fi

run xcrun devicectl device install app \
  --device "$device_identifier" \
  --timeout 120 \
  "$app_path"

if [ "$launch_app" -eq 1 ]; then
  run xcrun devicectl device process launch \
    --device "$device_identifier" \
    --terminate-existing \
    --timeout 30 \
    "$bundle_identifier"
fi

if [ "$dry_run" -eq 1 ]; then
  echo "Trockenlauf abgeschlossen: Es wurde nichts gebaut oder installiert."
elif [ "$launch_app" -eq 1 ]; then
  echo "Fertig: Flash-n-Flip wurde auf $device_name installiert und gestartet."
else
  echo "Fertig: Flash-n-Flip wurde auf $device_name installiert."
fi
