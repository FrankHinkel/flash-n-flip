export type StudyStartupSynchronization = {
  flushPendingReviews: () => Promise<unknown>;
  pullProgress: () => Promise<unknown>;
};

export type StudyStartupSynchronizationResult = {
  synchronized: boolean;
  failures: unknown[];
};

export async function runStudyStartupSynchronization({
  flushPendingReviews,
  pullProgress,
}: StudyStartupSynchronization): Promise<StudyStartupSynchronizationResult> {
  const failures: unknown[] = [];
  try {
    await flushPendingReviews();
  } catch (cause) {
    failures.push(cause);
  }
  try {
    await pullProgress();
  } catch (cause) {
    failures.push(cause);
  }
  return { synchronized: failures.length === 0, failures };
}
