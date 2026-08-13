export const localAppAssetTimeoutMs = 10_000;

export const appendLocalAppAsset = (
  element: HTMLLinkElement | HTMLScriptElement,
  parent: Pick<HTMLElement, "append">,
  errorMessage: string,
  timeoutMs = localAppAssetTimeoutMs,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const finish = (cause?: Error): void => {
      globalThis.clearTimeout(timeout);
      element.removeEventListener("load", loaded);
      element.removeEventListener("error", failed);
      if (cause) reject(cause);
      else resolve();
    };
    const loaded = () => finish();
    const failed = () => finish(new Error(errorMessage));
    const timeout = globalThis.setTimeout(
      () => finish(new Error(`${errorMessage} Zeitüberschreitung.`)),
      timeoutMs,
    );
    element.addEventListener("load", loaded);
    element.addEventListener("error", failed);
    parent.append(element);
  });
