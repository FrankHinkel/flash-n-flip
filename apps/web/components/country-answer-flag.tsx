import { flagEmoji } from "@flashcards/domain";

const flagLabel = (locale: string, countryName: string): string => {
  if (locale === "de") return `Flagge von ${countryName}`;
  if (locale === "es") return `Bandera de ${countryName}`;
  if (locale === "fr") return `Drapeau de ${countryName}`;
  return `Flag of ${countryName}`;
};

export function CountryAnswerFlag({
  countryCode,
  countryName,
  locale,
}: {
  countryCode: string;
  countryName: string;
  locale: string;
}) {
  return (
    <span
      className="country-answer-flag"
      role="img"
      aria-label={flagLabel(locale, countryName)}
    >
      {flagEmoji(countryCode)}
    </span>
  );
}
