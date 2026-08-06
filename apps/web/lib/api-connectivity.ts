export type ConnectivityFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export const apiIsReachable = async (
  fetcher: ConnectivityFetch = fetch,
  timeoutMs = 5_000,
): Promise<boolean> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher("/api/health", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};
