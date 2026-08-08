export type StudyStartupSynchronization = {
  flushPendingReviews: () => Promise<unknown>;
  pullProgress: () => Promise<unknown>;
};

export async function runStudyStartupSynchronization({
  flushPendingReviews,
  pullProgress,
}: StudyStartupSynchronization): Promise<boolean> {
  let synchronized = true;
  try {
    await flushPendingReviews();
  } catch {
    synchronized = false;
  }
  try {
    await pullProgress();
  } catch {
    synchronized = false;
  }
  return synchronized;
}
