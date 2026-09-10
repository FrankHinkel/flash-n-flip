export type CloudSyncCoalescer = {
  request(explicit?: boolean): void;
  suspend(): () => void;
};

export function createCloudSyncCoalescer(
  run: (explicit: boolean) => Promise<void>,
): CloudSyncCoalescer {
  let scheduled = false;
  let running = false;
  let requested = false;
  let requestedExplicit = false;
  let suspended = 0;

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
      try {
        await run(explicit);
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
      requested = false;
      requestedExplicit = false;
      return () => {
        suspended = Math.max(0, suspended - 1);
        if (!suspended && requested) schedule();
      };
    },
  };
}
