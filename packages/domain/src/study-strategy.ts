import { z } from "zod";

export const studyStrategyPresetSchema = z.enum([
  "BALANCED",
  "LONG_TERM",
  "EXAM",
  "OVERVIEW",
  "CUSTOM",
]);
export type StudyStrategyPreset = z.infer<typeof studyStrategyPresetSchema>;

export const studyNewReviewOrderSchema = z.enum([
  "REVIEW_FIRST",
  "MIXED",
  "NEW_FIRST",
]);
export type StudyNewReviewOrder = z.infer<typeof studyNewReviewOrderSchema>;

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    },
    { message: "Invalid calendar date" },
  );

export const studyStrategyConfigSchema = z
  .object({
    preset: studyStrategyPresetSchema,
    targetDate: dateOnlySchema.nullable(),
    minutesPerDay: z.number().int().min(5).max(480),
    studyDaysPerWeek: z.number().int().min(1).max(7),
    newCardsPerDay: z.number().int().min(1).max(1_000).nullable(),
    newReviewOrder: studyNewReviewOrderSchema,
    maximumReviewStreak: z.number().int().min(1).max(100),
    problemCardLimit: z.number().int().min(0).max(100),
    consolidationDays: z.number().int().min(0).max(90),
    paceTolerancePercent: z.number().int().min(5).max(50),
  })
  .strict();
export type StudyStrategyConfig = z.infer<typeof studyStrategyConfigSchema>;

const preset = (input: StudyStrategyConfig): Readonly<StudyStrategyConfig> =>
  Object.freeze(studyStrategyConfigSchema.parse(input));

export const studyStrategyPresets: Readonly<
  Record<StudyStrategyPreset, Readonly<StudyStrategyConfig>>
> = Object.freeze({
  BALANCED: preset({
    preset: "BALANCED",
    targetDate: null,
    minutesPerDay: 25,
    studyDaysPerWeek: 6,
    newCardsPerDay: null,
    newReviewOrder: "MIXED",
    maximumReviewStreak: 5,
    problemCardLimit: 6,
    consolidationDays: 0,
    paceTolerancePercent: 20,
  }),
  LONG_TERM: preset({
    preset: "LONG_TERM",
    targetDate: null,
    minutesPerDay: 25,
    studyDaysPerWeek: 6,
    newCardsPerDay: null,
    newReviewOrder: "REVIEW_FIRST",
    maximumReviewStreak: 20,
    problemCardLimit: 8,
    consolidationDays: 0,
    paceTolerancePercent: 15,
  }),
  EXAM: preset({
    preset: "EXAM",
    targetDate: null,
    minutesPerDay: 40,
    studyDaysPerWeek: 6,
    newCardsPerDay: null,
    newReviewOrder: "MIXED",
    maximumReviewStreak: 3,
    problemCardLimit: 5,
    consolidationDays: 7,
    paceTolerancePercent: 15,
  }),
  OVERVIEW: preset({
    preset: "OVERVIEW",
    targetDate: null,
    minutesPerDay: 25,
    studyDaysPerWeek: 6,
    newCardsPerDay: null,
    newReviewOrder: "NEW_FIRST",
    maximumReviewStreak: 2,
    problemCardLimit: 3,
    consolidationDays: 2,
    paceTolerancePercent: 25,
  }),
  CUSTOM: preset({
    preset: "CUSTOM",
    targetDate: null,
    minutesPerDay: 25,
    studyDaysPerWeek: 6,
    newCardsPerDay: null,
    newReviewOrder: "MIXED",
    maximumReviewStreak: 5,
    problemCardLimit: 6,
    consolidationDays: 0,
    paceTolerancePercent: 20,
  }),
});

export const resetStudyStrategy = (
  presetName: StudyStrategyPreset,
): StudyStrategyConfig => ({ ...studyStrategyPresets[presetName] });

export const defaultStudyStrategy = (): StudyStrategyConfig =>
  resetStudyStrategy("BALANCED");

const calendarDaysBetween = (start: Date, endDateOnly: string): number => {
  const [targetYear, targetMonth, targetDay] = endDateOnly
    .split("-")
    .map(Number) as [number, number, number];
  const startDay = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const targetDayValue = Date.UTC(targetYear, targetMonth - 1, targetDay);
  return Math.max(0, Math.ceil((targetDayValue - startDay) / 86_400_000));
};

const localDateOnly = (date: Date): string =>
  [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const completionDateOnly = (start: Date, calendarDays: number): string =>
  new Date(
    Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + calendarDays,
    ),
  )
    .toISOString()
    .slice(0, 10);

/*
 * Target dates are calendar dates in the learner's current timezone. Convert
 * their local date parts to UTC only for stable date-only arithmetic.
 */
const availableCalendarDays = (now: Date, targetDate: string): number =>
  Math.max(0, calendarDaysBetween(now, targetDate));

export const requiredNewCardsPerStudyDay = (input: {
  strategy: StudyStrategyConfig;
  remainingNewCards: number;
  fallbackDailyGoal: number;
  now: Date;
}): number => {
  if (input.remainingNewCards <= 0) return 0;
  const explicit = input.strategy.newCardsPerDay;
  if (explicit !== null) return explicit;
  if (!input.strategy.targetDate) return Math.max(1, input.fallbackDailyGoal);

  const calendarDays = Math.max(
    1,
    availableCalendarDays(input.now, input.strategy.targetDate) -
      input.strategy.consolidationDays,
  );
  const availableStudyDays = Math.max(
    1,
    Math.floor((calendarDays * input.strategy.studyDaysPerWeek) / 7),
  );
  return Math.max(1, Math.ceil(input.remainingNewCards / availableStudyDays));
};

export const studyPaceStatusSchema = z.enum([
  "NO_DATA",
  "TOO_SLOW",
  "SLOW",
  "ON_TRACK",
  "FAST",
  "TOO_FAST",
]);
export type StudyPaceStatus = z.infer<typeof studyPaceStatusSchema>;

export type StudyPaceProjection = {
  status: StudyPaceStatus;
  position: number;
  actualNewCardsPerStudyDay: number;
  targetNewCardsPerStudyDay: number;
  projectedCompletionDate: string | null;
};

export const projectStudyPace = (input: {
  strategy: StudyStrategyConfig;
  remainingNewCards: number;
  introducedInWindow: number;
  observedCalendarDays: number;
  fallbackDailyGoal: number;
  now: Date;
}): StudyPaceProjection => {
  const targetNewCardsPerStudyDay = requiredNewCardsPerStudyDay({
    strategy: input.strategy,
    remainingNewCards: input.remainingNewCards,
    fallbackDailyGoal: input.fallbackDailyGoal,
    now: input.now,
  });
  if (input.remainingNewCards <= 0) {
    return {
      status: "ON_TRACK",
      position: 50,
      actualNewCardsPerStudyDay: 0,
      targetNewCardsPerStudyDay: 0,
      projectedCompletionDate: localDateOnly(input.now),
    };
  }
  const observedStudyDays = Math.max(
    1,
    (Math.max(1, input.observedCalendarDays) *
      input.strategy.studyDaysPerWeek) /
      7,
  );
  const actualNewCardsPerStudyDay =
    input.introducedInWindow / observedStudyDays;
  const ratio = actualNewCardsPerStudyDay / targetNewCardsPerStudyDay;
  const tolerance = input.strategy.paceTolerancePercent / 100;
  const status: StudyPaceStatus =
    input.introducedInWindow <= 0
      ? "NO_DATA"
      : ratio < Math.max(0.25, 1 - tolerance * 2)
        ? "TOO_SLOW"
        : ratio < 1 - tolerance
          ? "SLOW"
          : ratio <= 1 + tolerance
            ? "ON_TRACK"
            : ratio <= 1 + tolerance * 2
              ? "FAST"
              : "TOO_FAST";
  const position =
    input.introducedInWindow <= 0
      ? 0
      : Math.max(0, Math.min(100, 50 + Math.log2(ratio) * 25));
  const remainingStudyDays =
    actualNewCardsPerStudyDay > 0
      ? Math.ceil(input.remainingNewCards / actualNewCardsPerStudyDay)
      : null;
  const projectedCalendarDays =
    remainingStudyDays === null
      ? null
      : Math.ceil((remainingStudyDays * 7) / input.strategy.studyDaysPerWeek);
  const projectedCompletionDate =
    projectedCalendarDays === null
      ? null
      : completionDateOnly(input.now, projectedCalendarDays);

  return {
    status,
    position,
    actualNewCardsPerStudyDay,
    targetNewCardsPerStudyDay,
    projectedCompletionDate,
  };
};
