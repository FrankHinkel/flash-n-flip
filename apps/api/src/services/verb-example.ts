export type VerbExampleLocale = "de" | "en" | "es" | "fr";

const uppercaseFirst = (value: string): string =>
  value ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : value;

const beginsWithFrenchVowelSound = (value: string): boolean =>
  /^[aeiouyàâäéèêëîïôöùûü]/i.test(value);

export function conjugationExampleSentence(
  locale: VerbExampleLocale,
  pronoun: string,
  form: string,
): string {
  const emphasizedForm = `**${form}**`;
  if (
    locale === "fr" &&
    pronoun.toLocaleLowerCase() === "je" &&
    beginsWithFrenchVowelSound(form)
  ) {
    return `J’${emphasizedForm}.`;
  }
  return `${uppercaseFirst(pronoun)} ${emphasizedForm}.`;
}

export function irregularVerbExampleSentences({
  locale,
  infinitive,
  forms,
  perfectAuxiliary = "have",
}: {
  locale: VerbExampleLocale;
  infinitive: string;
  forms: string[];
  perfectAuxiliary?: "have" | "be";
}): string[] {
  if (locale === "de") {
    return [
      `Der Infinitiv lautet **${infinitive}**.`,
      `Ich **${forms[0]}**.`,
      `Ich ${perfectAuxiliary === "be" ? "bin" : "habe"} **${forms[1]}**.`,
    ];
  }
  if (locale === "en") {
    return [
      `I can **${infinitive}**.`,
      `I **${forms[0]}**.`,
      `I have **${forms[1]}**.`,
    ];
  }
  if (locale === "es") {
    return [
      infinitive === "poder"
        ? "Quiero **poder** ayudar."
        : `Puedo **${infinitive}**.`,
      `Yo **${forms[0]}**.`,
      `Ayer **${forms[1]}**.`,
      `He **${forms[2]}**.`,
    ];
  }
  return [
    infinitive === "pouvoir"
      ? "Je veux **pouvoir** aider."
      : `Je peux **${infinitive}**.`,
    conjugationExampleSentence("fr", "je", forms[0]!),
    conjugationExampleSentence("fr", "nous", forms[1]!),
    perfectAuxiliary === "be"
      ? `Je suis **${forms[2]}**.`
      : `J’ai **${forms[2]}**.`,
  ];
}
