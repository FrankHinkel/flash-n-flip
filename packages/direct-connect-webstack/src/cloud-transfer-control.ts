export type CloudTransferStopReason = "paused" | "timeout";
export class CloudTransferStopped extends Error {
  constructor(readonly reason: CloudTransferStopReason) {
    super(reason === "paused" ? "Cloud transfer paused" : "Cloud request timed out");
    this.name = "CloudTransferStopped";
  }
}

// Native CloudKit/CloudKit JS cannot reliably cancel an already dispatched
// write. Its reply is fenced, and every later operation is refused. Retrying
// uses the same durable operation/revision IDs and conditional cloud writes.
export class CloudTransferControl {
  private readonly controller = new AbortController();
  private stopped: CloudTransferStopReason | null = null;
  private completed = 0;
  constructor(private readonly timeoutMs = 30_000,
    private readonly onCompleted?: (count: number) => void) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid cloud request timeout");
  }
  get signal(): AbortSignal { return this.controller.signal; }
  get reason(): CloudTransferStopReason | null { return this.stopped; }
  check = (): void => { if (this.stopped) throw new CloudTransferStopped(this.stopped); };
  stop(reason: CloudTransferStopReason = "paused"): void {
    if (this.stopped) return;
    this.stopped = reason;
    this.controller.abort();
  }
  async request<T>(operation: () => Promise<T>): Promise<T> {
    this.check();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (error: unknown, value?: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.signal.removeEventListener("abort", aborted);
        if (error !== null) reject(error);
        else {
          this.completed += 1;
          this.onCompleted?.(this.completed);
          resolve(value as T);
        }
      };
      const aborted = () => finish(new CloudTransferStopped(this.stopped ?? "paused"));
      const timer = setTimeout(() => this.stop("timeout"), this.timeoutMs);
      this.signal.addEventListener("abort", aborted, {once: true});
      // Both fulfillment and rejection are consumed even after cancellation.
      // A late native reply must not revive the run or cause an unhandled error.
      void Promise.resolve().then(() => { this.check(); return operation(); }).then(
        (value) => { try { this.check(); finish(null, value); } catch (error) { finish(error); } },
        (error) => finish(error),
      );
    });
  }
}

export type CloudTransferProblem = "timeout" | "account" | "quota" | "generation" | "unavailable" | "unknown";
export function cloudTransferProblem(error: unknown): CloudTransferProblem {
  if (error instanceof CloudTransferStopped && error.reason === "timeout") return "timeout";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (["ACCOUNT_CHANGED", "AUTHENTICATION_REQUIRED", "ACCOUNT_MISMATCH"].includes(code)) return "account";
  if (["QUOTA_EXCEEDED", "QUOTA_EXCEEDED_ERROR"].includes(code)) return "quota";
  if (["STALE_GENERATION", "ROOT_MISSING", "ROOT_CHANGED", "ROOT_DELETED"].includes(code)) return "generation";
  if (["SERVICE_UNAVAILABLE", "NETWORK_ERROR", "RETRY_LATER"].includes(code)) return "unavailable";
  return "unknown";
}
