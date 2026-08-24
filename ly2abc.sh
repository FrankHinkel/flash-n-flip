#!/bin/sh

set -eu

usage() {
  echo "Verwendung: $0 <ly-file>" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

ly_file=$1

if [ ! -f "$ly_file" ] || [ ! -r "$ly_file" ]; then
  echo "error: LilyPond-Datei ist nicht lesbar: $ly_file" >&2
  exit 1
fi

case "$ly_file" in
  *.ly|*.LY) ;;
  *)
    echo "error: Eingabedatei muss die Endung .ly haben: $ly_file" >&2
    exit 2
    ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js ist erforderlich." >&2
  exit 1
fi

script_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
input_dir=$(CDPATH= cd -- "$(dirname -- "$ly_file")" && pwd)
input_name=$(basename -- "$ly_file")

node "$script_root/tools/ly2abc-convert/src/book-cli.mjs" \
  "$input_dir/$input_name"
