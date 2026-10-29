# Automatic update of installed Flash-n-Flip Help

The startup boundary now checks installed Help after local-generation cleanup
and possible backup restoration, before mounting application and learning views.
It verifies the bundled signed catalog and compares the installed reference
tree's content hashes and stable hierarchy. The operation only runs for an
already installed Help root. An unchanged installation produces no mutations.

Updates use the existing atomic managed-tree installation and tombstones for
retired reference cards. Automatic installation preserves hidden/archived flags;
manual installation retains its existing activation behavior. Concurrent calls
within one runtime share the update promise. A failed fetch/signature check clears
the cached rejection; a failed install clears the in-flight update. The existing
Help remains available and the next startup retries. Startup logs a generic
warning on failure without exposing content.

No polling, private-content transfer, or scheduling changes were added. Curated
content remains local; the existing iCloud contract synchronizes activation
pointers rather than complete curated reference content.

## Verified

- 13 startup, signed-catalog, and metadata tests passed. Coverage includes absent
  Help, actual signature/hash rejection, retry, simulated failed transaction,
  duplicate invocation, removal of the two retired ABC cards, preservation of
  retained card IDs and visibility, and a runtime-module restart with no further
  writes. A separate personal card and its recorded review remain unchanged.
- Three existing managed-tree/curated-content repository tests passed.
- Web TypeScript check and the local-only Apple Web bundle build passed.
- Content-security and synchronization-integrity checks, focused formatting,
  and `git diff --check` passed.
- Real portable-app update simulation with persistent IndexedDB: installed the
  previous signed catalog (72 Help pages), replaced the served app bundle and
  catalog with the new version, and launched the app at its overview. Without
  opening Discover or pressing Update, the overview showed 70 cards. Opening
  Decks → ABC reference showed 1 / 13 instead of 1 / 15.

## Open device acceptance

The user owns installation and testing of the actual Mac/iPhone/iPad app.
SQLite process termination during commit, actual backup recovery on a device,
and physical multi-device operation have not been exercised in this change.
The automated failure test injects rejection before the transaction; it does not
claim to simulate a power loss inside a native SQLite commit.
