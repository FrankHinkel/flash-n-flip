const loopbackHostnames = new Set(["localhost", "127.0.0.1", "::1"]);

export const isLocalDevelopmentHostname = (hostname: string): boolean => {
  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return loopbackHostnames.has(normalized) || normalized.endsWith(".localhost");
};
