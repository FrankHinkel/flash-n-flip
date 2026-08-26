#!/bin/sh

set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <musicxml-or-mxl-file>" >&2
  exit 2
fi

input_file=$1
if [ ! -f "$input_file" ] || [ ! -r "$input_file" ]; then
  echo "error: MusicXML file is not readable: $input_file" >&2
  exit 1
fi

case "$input_file" in
  *.xml|*.XML|*.musicxml|*.MUSICXML|*.mxl|*.MXL) ;;
  *)
    echo "error: Input must use .xml, .musicxml or .mxl: $input_file" >&2
    exit 2
    ;;
esac

if ! command -v node >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  echo "error: Node.js and Python 3 are required." >&2
  exit 1
fi

script_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
input_dir=$(CDPATH= cd -- "$(dirname -- "$input_file")" && pwd)
input_name=$(basename -- "$input_file")
input_stem=${input_name%.*}
output_file=$input_dir/$input_stem.abc
report_file=$input_dir/$input_stem.mxml2abc-report.json

if [ -e "$output_file" ] || [ -e "$report_file" ]; then
  echo "error: Refusing to overwrite an existing ABC or report file." >&2
  exit 1
fi

pnpm --dir "$script_root" --filter @flashcards/domain build >/dev/null
node "$script_root/tools/mxml2abc-convert/src/cli.mjs" \
  "$input_dir/$input_name" \
  --output "$output_file" \
  --report "$report_file"

echo "written: $output_file"
echo "report:  $report_file"
