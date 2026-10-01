export type CloudSyncCoalescer = {
  request(explicit?: boolean): void;
  suspend(): () => void;
};

export function createCloudSyncCoalescer(
  run: (explicit: boolean, mayRun: () => boolean) => Promise<void>,
  onError: (cause: unknown) => void = () => undefined,
): CloudSyncCoalescer {
  let scheduled = false;
  let running = false;
  let requested = false;
  let requestedExplicit = false;
  let suspended = 0;
  let generation = 0;

  const schedule = () => {
    if (scheduled || running || suspended) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      if (!requested || running || suspended) return;
      const explicit = requestedExplicit;
      requested = false;
      requestedExplicit = false;
      running = true;
      const currentGeneration = generation;
      try {
        await run(
          explicit,
          () => !suspended && generation === currentGeneration,
        );
      } catch (cause) {
        onError(cause);
      } finally {
        running = false;
        if (requested) schedule();
      }
    });
  };

  return {
    request(explicit = false) {
      if (suspended) return;
      requested = true;
      requestedExplicit ||= explicit;
      schedule();
    },
    suspend() {
      suspended += 1;
      generation += 1;
      requested = false;
      requestedExplicit = false;
      let resumed = false;
      return () => {
        if (resumed) return;
        resumed = true;
        suspended = Math.max(0, suspended - 1);
        if (!suspended && requested) schedule();
      };
    },
  };
}
