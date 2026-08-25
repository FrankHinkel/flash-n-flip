import { uiMessages, type UiMessageKey } from "@flashcards/i18n";

export const uiMessageKey = (english: string, german: string): UiMessageKey => {
  const entry = Object.entries(uiMessages).find(
    ([, value]) => value.en === english && value.de === german,
  );
  if (!entry) throw new Error(`Missing UI message: ${english}`);
  return entry[0] as UiMessageKey;
};
