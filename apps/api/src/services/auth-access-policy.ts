export type AuthAccessPolicy = {
  allowedEmailDomains: string[];
  publicRegistrationEnabled: boolean;
};

export const tunnelAdminEmail = "tunnel-admin@flash-n-flip.invalid";

export const normalizeEmailDomain = (value: string): string =>
  value.trim().toLowerCase().replace(/^@/, "");

export const emailMatchesAllowedDomains = (
  email: string,
  allowedEmailDomains: string[],
): boolean => {
  const separator = email.lastIndexOf("@");
  if (separator < 1 || separator === email.length - 1) return false;
  const domain = normalizeEmailDomain(email.slice(separator + 1));
  return allowedEmailDomains.some(
    (allowedDomain) => normalizeEmailDomain(allowedDomain) === domain,
  );
};
