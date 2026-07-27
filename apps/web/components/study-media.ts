export type StudyMediaController = {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
};

export const selectStudyMedia = <T extends StudyMediaController>(
  media: readonly T[],
): T | undefined =>
  media.find((item) => !item.paused && !item.ended) ?? media[0];

export const toggleStudyMedia = async (
  media: StudyMediaController,
): Promise<"played" | "paused"> => {
  if (!media.paused && !media.ended) {
    media.pause();
    return "paused";
  }
  if (media.ended) media.currentTime = 0;
  await media.play();
  return "played";
};
