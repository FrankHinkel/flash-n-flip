export type StudyBadgeCardState = {
  due: string;
  reps: number;
};

export type StudyBadgeDueBucket = {
  due: string;
  count: number;
};

export type StudyBadgeTransition = {
  at: string;
  dueCount: number;
};

export type StudyBadgePlan = {
  dueNow: number;
  transitions: StudyBadgeTransition[];
};

export const maximumStudyBadgeTransitions = 60;
const preciseStudyBadgeTransitions = 48;
const minuteMs = 60_000;

const compactTransitions = (
  transitions: readonly StudyBadgeTransition[],
  maximum: number,
): StudyBadgeTransition[] => {
  if (transitions.length <= maximum) return [...transitions];
  if (maximum <= 0) return [];
  const preciseCount = Math.min(preciseStudyBadgeTransitions, maximum);
  const precise = transitions.slice(0, preciseCount);
  const remainingSlots = maximum - precise.length;
  if (remainingSlots <= 0) return precise;

  const distant = transitions.slice(precise.length);
  const compacted: StudyBadgeTransition[] = [];
  for (let slot = 0; slot < remainingSlots; slot += 1) {
    const end = Math.ceil(((slot + 1) * distant.length) / remainingSlots);
    const transition = distant[end - 1];
    if (transition) compacted.push(transition);
  }
  return [...precise, ...compacted];
};

export const buildStudyBadgePlan = (
  cards: readonly StudyBadgeCardState[],
  now: Date,
  maximumTransitions = maximumStudyBadgeTransitions,
): StudyBadgePlan =>
  buildStudyBadgePlanFromDueBuckets(
    cards
      .filter((card) => card.reps > 0)
      .map((card) => ({ due: card.due, count: 1 })),
    now,
    maximumTransitions,
  );

export const buildStudyBadgePlanFromDueBuckets = (
  buckets: readonly StudyBadgeDueBucket[],
  now: Date,
  maximumTransitions = maximumStudyBadgeTransitions,
): StudyBadgePlan => {
  const nowMs = now.getTime();
  let dueNow = 0;
  const futureMinutes = new Map<number, number>();

  for (const bucket of buckets) {
    if (!Number.isSafeInteger(bucket.count) || bucket.count <= 0) continue;
    const dueMs = Date.parse(bucket.due);
    if (!Number.isFinite(dueMs)) continue;
    if (dueMs <= nowMs) {
      dueNow += bucket.count;
      continue;
    }
    const minute = Math.ceil(dueMs / minuteMs) * minuteMs;
    futureMinutes.set(minute, (futureMinutes.get(minute) ?? 0) + bucket.count);
  }

  let cumulative = dueNow;
  const transitions = [...futureMinutes.entries()]
    .sort(([left], [right]) => left - right)
    .map(([at, count]) => {
      cumulative += count;
      return { at: new Date(at).toISOString(), dueCount: cumulative };
    });

  return {
    dueNow,
    transitions: compactTransitions(
      transitions,
      Math.max(0, Math.floor(maximumTransitions)),
    ),
  };
};
