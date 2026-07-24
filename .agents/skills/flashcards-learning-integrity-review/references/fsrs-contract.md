# FSRS contract

- Persist rating, reviewed-at instant, timezone, elapsed days, scheduled days, state, stability, difficulty, lapses, reps, parameter set, and scheduler version.
- Use ratings `Again`, `Hard`, `Good`, and `Easy` with stable numeric mapping.
- Generate preview intervals without mutating persisted state.
- Apply a rating once by immutable event ID.
- Rebuild derived card state by ordered event replay when consistency is questioned.
- Keep deck revisions independent from review events.
- Cover first review, lapse, same-day learning, timezone boundary, delayed review, and parameter migration with fixtures.
