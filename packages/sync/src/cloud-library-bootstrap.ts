import {
  cloudLibraryBindingSchema,
  cloudLibraryRootSchema,
  type CloudLibraryBinding,
  type CloudLibraryRoot,
} from "@flashcards/domain/cloud-library";
import { CloudLibraryError, type CloudRecordStore } from "./cloud-library.js";

export type CloudEnvironment = CloudLibraryBinding["environment"];
export const cloudLibraryRootRecordName = "library.root.v1";

export interface CloudLibraryBindingRepository {
  read(environment: CloudEnvironment): Promise<CloudLibraryBinding | null>;
  reserve(candidate: CloudLibraryBinding): Promise<CloudLibraryBinding>;
  confirm(expected: CloudLibraryBinding, root: CloudLibraryRoot): Promise<void>;
}

export class CloudLibraryBootstrapError extends Error {
  constructor(public readonly code: "ACCOUNT_MISMATCH" | "ROOT_MISSING" |
    "ROOT_CHANGED" | "ROOT_DELETED" | "LOCAL_BINDING_CHANGED") {
    super(code);
    this.name = "CloudLibraryBootstrapError";
  }
}

const sameRoot = (a: CloudLibraryRoot, b: CloudLibraryRoot): boolean =>
  a.libraryId === b.libraryId && a.libraryGeneration === b.libraryGeneration;

// Called inside the platform's durable read/write transaction.
export function reserveCloudLibraryBinding(
  existing: CloudLibraryBinding | null,
  candidate: CloudLibraryBinding,
): CloudLibraryBinding {
  const proposed = cloudLibraryBindingSchema.parse(candidate);
  if (proposed.phase !== "pending" || proposed.root.deleted) {
    throw new CloudLibraryBootstrapError("LOCAL_BINDING_CHANGED");
  }
  if (!existing) return proposed;
  const current = cloudLibraryBindingSchema.parse(existing);
  if (current.environment !== proposed.environment || current.account !== proposed.account) {
    throw new CloudLibraryBootstrapError("ACCOUNT_MISMATCH");
  }
  return current;
}

// A pending binding may adopt the winner of another device's create-only write.
// A confirmed binding must never follow a different root/generation silently.
export function confirmCloudLibraryBinding(
  existing: CloudLibraryBinding | null,
  expected: CloudLibraryBinding,
  remoteRoot: CloudLibraryRoot,
): CloudLibraryBinding {
  const root = cloudLibraryRootSchema.parse(remoteRoot);
  const expectedBinding = cloudLibraryBindingSchema.parse(expected);
  if (!existing) throw new CloudLibraryBootstrapError("LOCAL_BINDING_CHANGED");
  const current = cloudLibraryBindingSchema.parse(existing);
  if (current.environment !== expectedBinding.environment || current.account !== expectedBinding.account) {
    throw new CloudLibraryBootstrapError("ACCOUNT_MISMATCH");
  }
  if (root.deleted) throw new CloudLibraryBootstrapError("ROOT_DELETED");
  if (current.phase === "bound" && !sameRoot(current.root, root)) {
    throw new CloudLibraryBootstrapError("ROOT_CHANGED");
  }
  if (current.phase === "pending" && !sameRoot(current.root, expectedBinding.root)) {
    throw new CloudLibraryBootstrapError("LOCAL_BINDING_CHANGED");
  }
  return { ...current, phase: "bound", root };
}

export async function connectCloudLibrary(input: {
  environment: CloudEnvironment;
  account: string;
  bindings: CloudLibraryBindingRepository;
  storeForAccount(account: string): CloudRecordStore;
  assertAccount(): Promise<void>;
  randomUUID(): string;
}): Promise<CloudLibraryRoot> {
  // Reserve before the first cloud operation. A crashed/restarted client reuses
  // the pending identity rather than creating another library on every retry.
  const binding = await input.bindings.reserve({
    environment: input.environment,
    account: input.account,
    phase: "pending",
    root: cloudLibraryRootSchema.parse({
      libraryId: input.randomUUID(),
      libraryGeneration: input.randomUUID(),
      protocolVersion: 1,
      kind: "library-root",
      deleted: false,
    }),
  });
  await input.assertAccount();
  const store = input.storeForAccount(binding.account);
  let remote = await store.read(cloudLibraryRootRecordName);
  if (!remote) {
    if (binding.phase === "bound") throw new CloudLibraryBootstrapError("ROOT_MISSING");
    try {
      await store.compareAndSwap(cloudLibraryRootRecordName, null, binding.root);
    } catch (error) {
      if (!(error instanceof CloudLibraryError && error.code === "WRITE_CONFLICT")) throw error;
    }
    remote = await store.read(cloudLibraryRootRecordName);
  }
  if (!remote) throw new CloudLibraryBootstrapError("ROOT_MISSING");
  const root = cloudLibraryRootSchema.parse(remote.value);
  if (root.deleted) throw new CloudLibraryBootstrapError("ROOT_DELETED");
  if (binding.phase === "bound" && !sameRoot(binding.root, root)) {
    throw new CloudLibraryBootstrapError("ROOT_CHANGED");
  }
  await input.assertAccount();
  await input.bindings.confirm(binding, root);
  // A final account change cannot turn success for A into success for B. The
  // durable binding remains pinned to A; no learner data has been touched.
  await input.assertAccount();
  return root;
}
