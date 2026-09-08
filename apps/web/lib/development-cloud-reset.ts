import {
  atomicCloudRootSchema,
  cloudLibraryIdentitySchema,
  cloudLibraryRootSchema,
  type CloudLibraryIdentity,
} from "@flashcards/domain/cloud-library";
import type { CloudRecordStore } from "@flashcards/sync/cloud-library";
import {
  atomicCloudRootName,
  type CloudAtomicStore,
} from "@flashcards/sync/cloud-library-atomic";
import { cloudLibraryRootRecordName } from "@flashcards/sync/cloud-library-bootstrap";

export const cloudLibraryZoneMarkerRecordName = "library.zone.v2";

type AtomicZoneStore = CloudAtomicStore & {
  createZone(): Promise<void>;
  deleteZone(): Promise<void>;
};

type ZoneMarker = CloudLibraryIdentity & { phase: "ready" };

const identityFrom = (value: {
  libraryId: string;
  libraryGeneration: string;
}): CloudLibraryIdentity =>
  cloudLibraryIdentitySchema.parse({
    libraryId: value.libraryId,
    libraryGeneration: value.libraryGeneration,
  });

const sameIdentity = (
  left: CloudLibraryIdentity,
  right: CloudLibraryIdentity,
): boolean =>
  left.libraryId === right.libraryId &&
  left.libraryGeneration === right.libraryGeneration;

const markerIdentity = (value: unknown): ZoneMarker => {
  if (!value || typeof value !== "object" || !("phase" in value)) {
    throw new Error("Invalid cloud zone marker");
  }
  const phase = value.phase;
  if (phase !== "ready") throw new Error("Cloud zone marker is not ready");
  if (!("libraryId" in value) || !("libraryGeneration" in value)) {
    throw new Error("Invalid cloud zone marker identity");
  }
  const identity = identityFrom({
    libraryId: String(value.libraryId),
    libraryGeneration: String(value.libraryGeneration),
  });
  return { ...identity, phase };
};

const confirmAtomicRoot = async (
  store: AtomicZoneStore,
  identity: CloudLibraryIdentity,
): Promise<void> => {
  const record = await store.read(atomicCloudRootName);
  if (!record) throw new Error("Cloud library zone is missing");
  const root = atomicCloudRootSchema.parse(record.value);
  if (
    root.deleted ||
    root.libraryId !== identity.libraryId ||
    root.libraryGeneration !== identity.libraryGeneration
  ) {
    throw new Error("Cloud library zone belongs to another generation");
  }
};

export async function readAdoptableDevelopmentCloudLibrary(input: {
  environment: "development" | "production";
  oldIdentity: CloudLibraryIdentity;
  defaultStore: CloudRecordStore;
  atomicStoreForIdentity(identity: CloudLibraryIdentity): AtomicZoneStore;
}): Promise<CloudLibraryIdentity> {
  if (input.environment !== "development") {
    throw new Error(
      "Development adoption cannot modify the production environment",
    );
  }
  const oldIdentity = cloudLibraryIdentitySchema.parse(input.oldIdentity);
  const [rootRecord, markerRecord] = await Promise.all([
    input.defaultStore.read(cloudLibraryRootRecordName),
    input.defaultStore.read(cloudLibraryZoneMarkerRecordName),
  ]);
  if (!rootRecord || !markerRecord) {
    throw new Error("Replacement cloud library markers are incomplete");
  }
  const root = cloudLibraryRootSchema.parse(rootRecord.value);
  const rootIdentity = identityFrom(root);
  const markerIdentityValue = identityFrom(markerIdentity(markerRecord.value));
  if (
    root.deleted ||
    sameIdentity(rootIdentity, oldIdentity) ||
    !sameIdentity(rootIdentity, markerIdentityValue)
  ) {
    throw new Error("Replacement cloud library markers are inconsistent");
  }
  await confirmAtomicRoot(
    input.atomicStoreForIdentity(rootIdentity),
    rootIdentity,
  );
  return rootIdentity;
}

export async function replaceDevelopmentCloudLibrary(input: {
  environment: "development" | "production";
  oldIdentity: CloudLibraryIdentity;
  defaultStore: CloudRecordStore;
  atomicStoreForIdentity(identity: CloudLibraryIdentity): AtomicZoneStore;
  initialize(
    store: AtomicZoneStore,
    identity: CloudLibraryIdentity,
  ): Promise<void>;
  randomUUID(): string;
}): Promise<{ identity: CloudLibraryIdentity; mode: "replaced" | "adopted" }> {
  if (input.environment !== "development") {
    throw new Error(
      "Development reset cannot modify the production environment",
    );
  }
  const oldIdentity = cloudLibraryIdentitySchema.parse(input.oldIdentity);
  const [rootRecord, markerRecord] = await Promise.all([
    input.defaultStore.read(cloudLibraryRootRecordName),
    input.defaultStore.read(cloudLibraryZoneMarkerRecordName),
  ]);
  const rootIdentity = rootRecord
    ? identityFrom(cloudLibraryRootSchema.parse(rootRecord.value))
    : null;
  const marker = markerRecord ? markerIdentity(markerRecord.value) : null;
  const markerValue = marker ? identityFrom(marker) : null;

  if (rootIdentity && markerValue && sameIdentity(rootIdentity, markerValue)) {
    if (!sameIdentity(rootIdentity, oldIdentity)) {
      await confirmAtomicRoot(
        input.atomicStoreForIdentity(rootIdentity),
        rootIdentity,
      );
      return { identity: rootIdentity, mode: "adopted" };
    }
    await input.atomicStoreForIdentity(oldIdentity).deleteZone();
  } else if (rootIdentity || markerValue) {
    const candidates = [rootIdentity, markerValue].filter(
      (identity): identity is CloudLibraryIdentity =>
        Boolean(identity && !sameIdentity(identity, oldIdentity)),
    );
    const candidate = candidates[0];
    if (
      !candidate ||
      candidates.some((identity) => !sameIdentity(identity, candidate)) ||
      (rootIdentity &&
        !sameIdentity(rootIdentity, oldIdentity) &&
        !sameIdentity(rootIdentity, candidate)) ||
      (markerValue &&
        !sameIdentity(markerValue, oldIdentity) &&
        !sameIdentity(markerValue, candidate))
    ) {
      throw new Error("Cloud reset markers are incomplete or inconsistent");
    }
    await confirmAtomicRoot(input.atomicStoreForIdentity(candidate), candidate);
    if (!rootIdentity || sameIdentity(rootIdentity, oldIdentity)) {
      await input.defaultStore.compareAndSwap(
        cloudLibraryRootRecordName,
        rootRecord?.changeTag ?? null,
        cloudLibraryRootSchema.parse({
          ...candidate,
          protocolVersion: 1,
          kind: "library-root",
          deleted: false,
        }),
      );
    }
    if (!markerValue || sameIdentity(markerValue, oldIdentity)) {
      await input.defaultStore.compareAndSwap(
        cloudLibraryZoneMarkerRecordName,
        markerRecord?.changeTag ?? null,
        { ...candidate, phase: "ready" },
      );
    }
    return { identity: candidate, mode: "adopted" };
  }

  const identity = cloudLibraryIdentitySchema.parse({
    libraryId: input.randomUUID(),
    libraryGeneration: input.randomUUID(),
  });
  const atomic = input.atomicStoreForIdentity(identity);
  await atomic.createZone();
  await input.initialize(atomic, identity);
  await confirmAtomicRoot(atomic, identity);
  await input.defaultStore.compareAndSwap(
    cloudLibraryRootRecordName,
    rootRecord?.changeTag ?? null,
    cloudLibraryRootSchema.parse({
      ...identity,
      protocolVersion: 1,
      kind: "library-root",
      deleted: false,
    }),
  );
  await input.defaultStore.compareAndSwap(
    cloudLibraryZoneMarkerRecordName,
    markerRecord?.changeTag ?? null,
    { ...identity, phase: "ready" },
  );
  return { identity, mode: "replaced" };
}
