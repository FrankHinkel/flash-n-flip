# iCloud two-device acceptance

The implementation must pass automated checks and a native build before this
checklist is handed to the user as ready. A commit/push is not a VPS deployment.
Both clients must contain the same implementation and use the same CloudKit
environment and Apple account. Use a disposable test deck, not valuable content.

1. Enable iCloud on device A in Settings. Import/create a small deck containing
   text, an image and audio. Wait for all displayed deck statuses to complete.
2. Enable iCloud on device B. Confirm deck hierarchy, card contents and playable
   media. Close/reopen B, disconnect networking and open/study the downloaded deck.
3. While both are offline, review the same card on A, then later on B. Reconnect
   B first, then A. The later actual B review must win on BOTH devices even though
   A uploads last. Both review events must remain in history.
4. Reopen both apps and repeat synchronization. No duplicate cards/reviews and no
   reverted due date are allowed. Repeat with a virtual card if used by the deck.
5. Interrupt a media upload, close the app, reopen and resume. A partial deck must
   not be shown as fully synchronized. After completion, verify media offline.
6. Edit the same content differently offline on A and B. A conflict must be shown,
   never resolved by upload timestamp. Explicitly keep one content version and
   confirm both devices converge while review history is preserved.
7. On A choose 'Remove only from this device'. B and iCloud retain the deck and
   progress. Re-download on A; progress must return. Signing out/pausing must not
   erase anything and must not restart peer replication.
8. Put B offline and record another review. On A confirm 'Reset learning progress
   everywhere'. After physical cloud erasure, A starts fresh. Reconnect B: its old
   review must not resurrect erased progress. Record a NEW review and restart;
   replaying the completed command must not delete that new review.
9. Confirm 'Delete deck everywhere' on A (children first). B removes the deck on
   reconnect. Inspect the private custom zone: the deck's indexed payloads must
   be physically gone, leaving only non-payload control/tombstone metadata.
10. Switch the signed-in account or remove the custom zone externally. Sync must
    stop, retain local data/outbox and never silently create a replacement library.

Record client versions, iOS/browser versions, environment, test time and outcomes.
Never include Apple passwords, API tokens or private deck contents in logs.
Any silent review loss, duplicate review, incomplete installation marked complete,
or resurrection after confirmed deletion blocks acceptance.
