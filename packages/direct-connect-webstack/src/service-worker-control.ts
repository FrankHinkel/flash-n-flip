const controlledBy = (
  serviceWorker: Pick<ServiceWorkerContainer, "controller">,
  expectedScriptPath: string,
): boolean => {
  const scriptUrl = serviceWorker.controller?.scriptURL;
  if (!scriptUrl) return false;
  try {
    return new URL(scriptUrl).pathname === expectedScriptPath;
  } catch {
    return false;
  }
};

export const waitForServiceWorkerControl = async (
  serviceWorker: Pick<
    ServiceWorkerContainer,
    "controller" | "addEventListener" | "removeEventListener"
  >,
  expectedScriptPath = "/sw.js",
  timeoutMs = 5_000,
): Promise<void> => {
  if (controlledBy(serviceWorker, expectedScriptPath)) return;

  await new Promise<void>((resolve, reject) => {
    const finish = (cause?: Error): void => {
      globalThis.clearTimeout(timeout);
      serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (cause) reject(cause);
      else resolve();
    };
    const onControllerChange = (): void => {
      if (controlledBy(serviceWorker, expectedScriptPath)) finish();
    };
    const timeout = globalThis.setTimeout(
      () =>
        finish(
          new Error(
            "Der lokale App-Dienst konnte die Seite noch nicht übernehmen.",
          ),
        ),
      timeoutMs,
    );
    serviceWorker.addEventListener("controllerchange", onControllerChange);
    onControllerChange();
  });
};
