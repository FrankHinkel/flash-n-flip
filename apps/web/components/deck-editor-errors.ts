import { ApiError } from "@flashcards/api-client";

export type EditorSubject = "deck" | "card";
export type EditorLocale = "en" | "de";

const localized = (locale: EditorLocale, english: string, german: string) =>
  locale === "de" ? german : english;

export const editorSaveError = (
  cause: unknown,
  locale: EditorLocale,
  subject: EditorSubject,
): string => {
  if (cause instanceof ApiError) {
    if (cause.status === 409) {
      return subject === "deck"
        ? localized(
            locale,
            "This deck changed on another device. Reload it before saving again.",
            "Dieses Lernset wurde auf einem anderen Gerät geändert. Lade es neu, bevor du erneut speicherst.",
          )
        : localized(
            locale,
            "This card changed on another device. Reload it before saving again.",
            "Diese Karte wurde auf einem anderen Gerät geändert. Lade sie neu, bevor du erneut speicherst.",
          );
    }
    if (cause.status === 401) {
      return localized(
        locale,
        "Your session has expired. Sign in again.",
        "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
      );
    }
    if (cause.status === 400) {
      return localized(
        locale,
        "The changes are invalid. Check the entered content.",
        "Die Änderungen sind ungültig. Prüfe die eingegebenen Inhalte.",
      );
    }
    return localized(
      locale,
      "The server could not save the changes. Please try again.",
      "Der Server konnte die Änderungen nicht speichern. Bitte versuche es erneut.",
    );
  }

  return localized(
    locale,
    "The connection failed. Check your network and try again.",
    "Die Verbindung ist fehlgeschlagen. Prüfe dein Netzwerk und versuche es erneut.",
  );
};
