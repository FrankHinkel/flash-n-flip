export const developerReferenceTag = "Developer reference";
export const optionalPracticeTag = "Optional practice";

export function hasDeveloperReferenceTag(
  ...deckTagGroups: (readonly string[] | null | undefined)[]
): boolean {
  return deckTagGroups.some((tags) => tags?.includes(developerReferenceTag));
}

export function hasOptionalPracticeTag(
  ...deckTagGroups: (readonly string[] | null | undefined)[]
): boolean {
  return deckTagGroups.some((tags) => tags?.includes(optionalPracticeTag));
}
