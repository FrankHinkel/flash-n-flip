---
name: flashcards-learning-integrity-review
description: Review FlashCards scheduling and learning integrity. Use for FSRS, ratings, intervals, queues, day boundaries, statistics, review logs, scheduler upgrades, deck updates, or any change that can alter due dates or learning progress.
---

# FlashCards Learning Integrity Review

1. Read `references/fsrs-contract.md`.
2. Trace rating input through scheduler output, persisted review event, sync, and next queue.
3. Run `scripts/check-learning-integrity.sh`.
4. Compare behavior against deterministic test vectors.
5. Report data-loss or silent rescheduling risks as `Release-Blocker`.

## Mandatory guardrails

- Use the pinned FSRS implementation; do not invent scheduler formulas.
- Persist scheduler version, parameters, timezone, rating, and review timestamp.
- Treat `Hard` as recalled with difficulty, never as forgotten.
- Keep review events immutable and uniquely identified.
- Preserve personal progress when subscribed deck content changes.
- Simulate and document scheduler migrations before enabling them.
- Keep queue generation deterministic for the same state and clock.
