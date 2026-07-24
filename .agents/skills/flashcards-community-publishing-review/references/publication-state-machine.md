# Publication state machine

```text
DRAFT -> SUBMITTED -> IN_REVIEW -> CHANGES_REQUESTED
                         |                 |
                         v                 v
                      APPROVED <------ SUBMITTED
                         |
                         v
                     PUBLISHED -> SUSPENDED -> PUBLISHED
                         |
                         v
                      ARCHIVED
```

- Only an Admin can enter `APPROVED`, `PUBLISHED`, `SUSPENDED`, or restore `PUBLISHED`.
- `PUBLISHED` points to one immutable approved revision.
- Editing published content creates a new `DRAFT`.
- Every transition stores actor, timestamp, reason, and previous state.
- A report does not delete content or make a moderation decision automatically.
