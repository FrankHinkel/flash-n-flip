/** Product version: major.minor.commit-build. Independent of Apple upload IDs. */
export function parseAppVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) throw new Error(`Invalid application version: ${value}`);
  const [major, minor, build] = match.slice(1).map(Number);
  if (![major, minor, build].every(Number.isSafeInteger)) {
    throw new Error(`Application version exceeds the integer limit: ${value}`);
  }
  return { major, minor, build };
}

export function formatAppVersion(value) {
  const { major, minor, build } = parseAppVersion(value);
  return build === 0 ? `${major}.${minor}` : `${major}.${minor}.${build}`;
}

export function appStoreVersion(value) {
  const { major, minor } = parseAppVersion(value);
  return `${major}.${minor}`;
}

export function isAppStoreRelease(value) {
  return parseAppVersion(value).build === 0;
}
