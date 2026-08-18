# ADR 0042: Plan-specific study strategies and pace guidance

- Status: Accepted
- Date: 2026-08-18

## Context

A single fixed learning policy does not fit both long-term retention and a
time-bounded first pass through a large collection. Learners also need a clear
answer to two different questions: which cards belong to today's plan, and
whether their pace is likely to finish the first pass on time.

The scheduler must nevertheless keep one authoritative FSRS state per card. A
card may belong to several named study plans, so a plan must not invent a second
due date or reinterpret the meaning of Again, Hard, Good, or Easy.

## Decision

Each named study plan stores a versioned strategy configuration. Existing V1
plans are read as **Balanced** and are upgraded to V2 when saved. The active
plan remains a device-local selection; the plan and its strategy remain normal
synced local-first entities.

The built-in presets are:

| Preset    | Icon                | Intended use                    | Initial queue policy                        |
| --------- | ------------------- | ------------------------------- | ------------------------------------------- |
| Balanced  | `Lightbulb`         | Sustainable default             | Mix new cards into reviews                  |
| Long-term | `TreePine`          | Retention without a deadline    | Due reviews first                           |
| Exam      | `CalendarCheck`     | First pass before a target date | Short review streaks and consolidation time |
| Overview  | `Binoculars`        | Fast breadth before depth       | New cards first                             |
| Custom    | `SlidersHorizontal` | Plan-specific manual setup      | Editable balanced starting point            |

The editable configuration contains:

- optional target date and consolidation days;
- learning days per week and a planning budget in minutes;
- automatic or explicit new-card allowance;
- review-first, mixed, or new-first ordering;
- maximum review streak when cards are mixed;
- a daily cap for problem cards, defined as due cards with at least three
  recorded lapses;
- an adjustable tolerance corridor for the pace indicator.

Automatic new-card pacing uses the remaining new cards, available learning
days, target date, and consolidation buffer. Without a target date it falls
back to the global new-card goal and applies a preset factor: 0.7 for
Long-term, 1.0 for Balanced and Custom, 1.5 for Exam, and 2.0 for Overview. An
explicit new-card allowance overrides the factor. The same resulting target
drives both the pace indicator and the queue's daily allowance. The daily
allowance is persisted through the card's ordinary introduction state: cards
already introduced today reduce the remaining allowance after reopening or
restarting the app.

Problem-card caps affect only the normal daily plan. Deferred cards remain due,
are reported as such, and remain reachable through explicit additional
practice. Direct deck study and explicit additional practice do not apply the
cap.

## Pace indicator

The dashboard shows a non-animated meter from turtle to rabbit. Its visual
track runs through slow, target, and fast zones. Color is never the sole signal:
the current status, actual pace, target pace, and projected first-pass
completion are also written as text and exposed as an accessible `meter`.
Selecting a different preset or editing its values previews the changed target
and meter position immediately, before saving.

The projection is based on newly introduced cards over a rolling window of up
to seven calendar days, normalized to configured learning days per week. It is
guidance, not an FSRS forecast and not a guarantee that all reviews will be
complete by the target date.

## Reset and integrity rules

Resetting a preset replaces only the strategy configuration with its shipped
defaults. It must never delete or rewrite cards, review events, current FSRS
states, due dates, learning progress, outboxes, or synchronization watermarks.

Changing a preset may change today's selection and ordering immediately, but
does not reschedule existing reviews. Review events continue to record the
scheduler version, parameters, and before/after states needed for deterministic
replay and audit.

## Consequences

- The same card retains one due date even when several plans include it.
- A plan can emphasize breadth or retention without forking learning history.
- The target-date projection must be labelled as a first-pass projection.
- The minutes field is a planning and estimation input; it does not silently
  hide due reviews to force a time limit.
- Reusable named custom templates across multiple plans are a possible later
  addition. Today, every plan can independently become its own custom strategy.

## Verification

Focused tests cover preset resets, target-date pacing, pace classification,
new/review ordering, problem-card caps, V1 compatibility, and V2 persistence.
The dashboard must additionally be checked at an iPhone-sized viewport, with
keyboard navigation, enlarged text, light and dark appearance, and without
depending on color to communicate pace.
