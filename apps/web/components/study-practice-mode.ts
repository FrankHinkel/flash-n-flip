export const developerReferenceTag = "Developer reference";

export function hasDeveloperReferenceTag(
  ...deckTagGroups: (readonly string[] | null | undefined)[]
) {
  return deckTagGroups.some((tags) => tags?.includes(developerReferenceTag));
}

export function shouldUsePracticeAll(
  explicitlyRequested: boolean,
  ...deckTagGroups: (readonly string[] | null | undefined)[]
) {
  return explicitlyRequested || hasDeveloperReferenceTag(...deckTagGroups);
}
