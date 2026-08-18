import { describe, expect, it } from "vitest";

import {
  projectStudyPace,
  requiredNewCardsPerStudyDay,
  resetStudyStrategy,
} from "./study-strategy";

describe("study strategy", () => {
  it("resets every preset without sharing mutable state", () => {
    const first = resetStudyStrategy("EXAM");
    const second = resetStudyStrategy("EXAM");
    first.minutesPerDay = 5;

    expect(second.minutesPerDay).toBe(40);
    expect(second.consolidationDays).toBe(7);
  });

  it("derives an exam pace from remaining cards and consolidation time", () => {
    const strategy = {
      ...resetStudyStrategy("EXAM"),
      targetDate: "2026-03-08",
    };

    expect(
      requiredNewCardsPerStudyDay({
        strategy,
        remainingNewCards: 200,
        fallbackDailyGoal: 10,
        now: new Date("2026-02-01T12:00:00.000Z"),
      }),
    ).toBe(9);
  });

  it("uses distinct automatic pace targets when no deadline is set", () => {
    const targetFor = (
      preset: "LONG_TERM" | "BALANCED" | "EXAM" | "OVERVIEW",
    ) =>
      requiredNewCardsPerStudyDay({
        strategy: resetStudyStrategy(preset),
        remainingNewCards: 1_000,
        fallbackDailyGoal: 10,
        now: new Date("2026-02-01T12:00:00.000Z"),
      });

    expect(targetFor("LONG_TERM")).toBe(7);
    expect(targetFor("BALANCED")).toBe(10);
    expect(targetFor("EXAM")).toBe(15);
    expect(targetFor("OVERVIEW")).toBe(20);
  });

  it("moves the same observed pace left for the faster overview strategy", () => {
    const projectionFor = (preset: "BALANCED" | "OVERVIEW") =>
      projectStudyPace({
        strategy: resetStudyStrategy(preset),
        remainingNewCards: 1_000,
        introducedInWindow: 90,
        observedCalendarDays: 7,
        fallbackDailyGoal: 10,
        now: new Date("2026-02-01T12:00:00.000Z"),
      });

    const balanced = projectionFor("BALANCED");
    const overview = projectionFor("OVERVIEW");
    expect(balanced.status).toBe("TOO_FAST");
    expect(overview.status).toBe("ON_TRACK");
    expect(overview.position).toBeLessThan(balanced.position);
  });

  it("classifies pace with text-ready status in addition to position", () => {
    const strategy = {
      ...resetStudyStrategy("BALANCED"),
      newCardsPerDay: 10,
    };
    expect(
      projectStudyPace({
        strategy,
        remainingNewCards: 100,
        introducedInWindow: 60,
        observedCalendarDays: 7,
        fallbackDailyGoal: 10,
        now: new Date("2026-02-01T12:00:00.000Z"),
      }),
    ).toMatchObject({
      status: "ON_TRACK",
      actualNewCardsPerStudyDay: 10,
      targetNewCardsPerStudyDay: 10,
      position: 50,
    });
  });

  it("does not request more new cards after the first pass is complete", () => {
    const strategy = resetStudyStrategy("BALANCED");

    expect(
      requiredNewCardsPerStudyDay({
        strategy,
        remainingNewCards: 0,
        fallbackDailyGoal: 10,
        now: new Date("2026-02-01T12:00:00.000Z"),
      }),
    ).toBe(0);
    expect(
      projectStudyPace({
        strategy,
        remainingNewCards: 0,
        introducedInWindow: 0,
        observedCalendarDays: 7,
        fallbackDailyGoal: 10,
        now: new Date("2026-02-01T12:00:00.000Z"),
      }),
    ).toMatchObject({
      status: "ON_TRACK",
      targetNewCardsPerStudyDay: 0,
      projectedCompletionDate: "2026-02-01",
    });
  });
});
