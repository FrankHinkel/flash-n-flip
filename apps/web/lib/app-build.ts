export const formatAppBuildTime = (
  value: string,
  locale: string,
  timeZone?: string,
): string | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone,
  }).format(date);
};
