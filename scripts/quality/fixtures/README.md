# Import parity fixtures

`xefjord-german-parity.apkg` is an artificial APKG created by
`../generate-xefjord-german-fixture.mjs`. It contains one synthetic note, two
cards, and a ten-byte fake MP3 signature. It contains no copied Xefjord content
or user data.

The fixture intentionally uses the standalone template markers `German` and
`To German`. The pre-migration import plan removes these markers and assigns a
per-card language direction. The local parser at recovery start `35709be`
preserves them. The parity characterization test records this difference
without accepting it as the target behavior.

`xefjord-real-baselines.expected.json` contains only filenames, truncated file
hashes, locales, and structural counts from the local Xefjord comparison set.
The packages themselves remain untracked under `examples/Xefjord's/`. Set
`FNF_XEFJORD_FIXTURE_DIRECTORY` to that directory to verify all baselines
without logging card content.

The `general-*` files are deterministic artificial fixtures for classic and
modern APKG, Cloze, Image Occlusion, local FNF structured content and media,
quoted CSV, and Anki TSV. Generate them with
`../generate-general-import-fixtures.mjs`. Their full structural reference and
recovery-start results live in `general-import-parity.expected.json`.
