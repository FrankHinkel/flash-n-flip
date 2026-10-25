export type AppVersion = { major: number; minor: number; build: number };
export function parseAppVersion(value: string): AppVersion;
export function formatAppVersion(value: string): string;
export function appStoreVersion(value: string): string;
export function isAppStoreRelease(value: string): boolean;
