import {
  cloudLibraryRootSchema,
  type CloudLibraryIdentity,
  type CloudLibraryRoot,
} from "@flashcards/domain/cloud-library";
import type { CloudRecordStore } from "@flashcards/sync/cloud-library";
import type { CloudAtomicStore } from "@flashcards/sync/cloud-library-atomic";
import type { CloudLibraryBindingRepository } from "@flashcards/sync/cloud-library-bootstrap";
import { readAdoptableDevelopmentCloudLibrary } from "./development-cloud-reset";

type AtomicZoneStore = CloudAtomicStore & {
  createZone(): Promise<void>;
  deleteZone(): Promise<void>;
};

export async function recoverNativeDevelopmentCloudBinding(input: {
  allowed: boolean;
  cause: unknown;
  environment: "development" | "production";
  account: string;
  bindings: CloudLibraryBindingRepository;
  defaultStore: CloudRecordStore;
  atomicStoreForIdentity(identity: CloudLibraryIdentity): AtomicZoneStore;
}): Promise<CloudLibraryRoot | null> {
  const code =
    input.cause && typeof input.cause === "object" && "code" in input.cause
      ? String(input.cause.code)
      : "";
  if (
    !input.allowed ||
    input.environment !== "development" ||
    code !== "ROOT_CHANGED"
  ) {
    return null;
  }
  const binding = await input.bindings.read(input.environment);
  if (
    !binding ||
    binding.phase !== "bound" ||
    binding.account !== input.account ||
    !input.bindings.adoptDevelopment
  ) {
    throw input.cause;
  }
  const identity = await readAdoptableDevelopmentCloudLibrary({
    environment: input.environment,
    oldIdentity: {
      libraryId: binding.root.libraryId,
      libraryGeneration: binding.root.libraryGeneration,
    },
    defaultStore: input.defaultStore,
    atomicStoreForIdentity: input.atomicStoreForIdentity,
  });
  const root = cloudLibraryRootSchema.parse({
    ...identity,
    protocolVersion: 1,
    kind: "library-root",
    deleted: false,
  });
  await input.bindings.adoptDevelopment(binding, root);
  return root;
}
