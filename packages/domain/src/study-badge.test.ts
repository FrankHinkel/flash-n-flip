import { describe, expect, it } from "vitest";

import { buildStudyBadgePlan } from "./study-badge";

describe("buildStudyBadgePlan", () => {
  const now = new Date("2026-08-18T10:00:30.000Z");

  it("counts only learned cards that are already due", () => {
    expect(
      buildStudyBadgePlan(
        [
          { due: "2026-08-18T09:00:00.000Z", reps: 2 },
          { due: "2026-08-18T10:00:30.000Z", reps: 1 },
          { due: "2026-08-18T08:00:00.000Z", reps: 0 },
        ],
        now,
      ),
    ).toEqual({ dueNow: 2, transitions: [] });
  });

  it("rounds future due times up and groups equal minutes", () => {
    expect(
      buildStudyBadgePlan(
        [
          { due: "2026-08-18T10:00:31.000Z", reps: 1 },
          { due: "2026-08-18T10:00:59.999Z", reps: 4 },
          { due: "2026-08-18T10:01:00.001Z", reps: 1 },
        ],
        now,
      ),
    ).toEqual({
      dueNow: 0,
      transitions: [
        { at: "2026-08-18T10:01:00.000Z", dueCount: 2 },
        { at: "2026-08-18T10:02:00.000Z", dueCount: 3 },
      ],
    });
  });

  it("keeps the plan bounded while retaining the final cumulative count", () => {
    const cards = Array.from({ length: 100 }, (_, index) => ({
      due: new Date(now.getTime() + (index + 1) * 60_000).toISOString(),
      reps: 1,
    }));
    const plan = buildStudyBadgePlan(cards, now, 60);

    expect(plan.transitions).toHaveLength(60);
    expect(plan.transitions.slice(0, 48)).toEqual(
      cards.slice(0, 48).map((card, index) => ({
        at: new Date(
          Math.ceil(Date.parse(card.due) / 60_000) * 60_000,
        ).toISOString(),
        dueCount: index + 1,
      })),
    );
    expect(plan.transitions.at(-1)).toEqual({
      at: new Date(
        Math.ceil(Date.parse(cards.at(-1)!.due) / 60_000) * 60_000,
      ).toISOString(),
      dueCount: 100,
    });
  });
});
