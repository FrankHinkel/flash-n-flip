export type StudyLanguageDirectionInput = {
  languageMatrix: boolean;
  sourceLocale: string;
  targetLocale: string;
  contentLocales: readonly string[];
  contentLocale: string;
  matrixQuestionLocale: string;
};

export type StudyLanguageDirection = {
  questionLocale: string;
  answerLocale: string;
};

export function resolveActiveStudyContentLocale(input: {
  selectedDeckId: string;
  selectedContentLocale: string;
  activeDeck?: {
    targetLocale: string;
    defaultContentLocale: string;
    contentLocales: readonly string[];
  } | null;
}): string {
  if (input.selectedDeckId || !input.activeDeck) {
    return input.selectedContentLocale;
  }
  if (input.activeDeck.contentLocales.includes(input.activeDeck.targetLocale)) {
    return input.activeDeck.targetLocale;
  }
  if (
    input.activeDeck.contentLocales.includes(
      input.activeDeck.defaultContentLocale,
    )
  ) {
    return input.activeDeck.defaultContentLocale;
  }
  return input.activeDeck.contentLocales[0] ?? input.selectedContentLocale;
}

export function resolveDisplayedStudyLanguageDirection(
  input: StudyLanguageDirectionInput,
): StudyLanguageDirection {
  if (input.languageMatrix) {
    return {
      questionLocale: input.matrixQuestionLocale,
      answerLocale: input.contentLocale,
    };
  }
  if (
    input.sourceLocale === input.targetLocale &&
    input.contentLocales.includes(input.contentLocale)
  ) {
    return {
      questionLocale: input.contentLocale,
      answerLocale: input.contentLocale,
    };
  }
  return {
    questionLocale: input.sourceLocale,
    answerLocale: input.targetLocale,
  };
}

export function studyLanguageDirectionCode(
  direction: StudyLanguageDirection,
): string {
  const question = direction.questionLocale.toUpperCase();
  const answer = direction.answerLocale.toUpperCase();
  return question === answer ? question : `${question}→${answer}`;
}

export function studyLanguageDirectionLabel(
  direction: StudyLanguageDirection,
  uiLocale: string,
): string {
  const languageName = (locale: string): string => {
    try {
      return (
        new Intl.DisplayNames([uiLocale], { type: "language" }).of(locale) ??
        locale.toUpperCase()
      );
    } catch {
      return locale.toUpperCase();
    }
  };
  const question = languageName(direction.questionLocale);
  const answer = languageName(direction.answerLocale);
  if (direction.questionLocale === direction.answerLocale) {
    return uiLocale.split("-")[0] === "de"
      ? `Lernsprache: ${question}`
      : `Deck language: ${question}`;
  }
  return uiLocale.split("-")[0] === "de"
    ? `Sprachrichtung: Fragesprache ${question}, Antwortsprache ${answer}`
    : `Language direction: question language ${question}, answer language ${answer}`;
}
