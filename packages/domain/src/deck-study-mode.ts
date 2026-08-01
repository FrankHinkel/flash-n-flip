export const developerReferenceTag = "Developer reference";

export function hasDeveloperReferenceTag(
  ...deckTagGroups: (readonly string[] | null | undefined)[]
): boolean {
  return deckTagGroups.some((tags) => tags?.includes(developerReferenceTag));
}
