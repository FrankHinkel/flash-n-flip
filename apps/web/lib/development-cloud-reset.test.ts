import { describe, expect, it, vi } from "vitest";
import { atomicCloudRootName } from "@flashcards/sync/cloud-library-atomic";
import { cloudLibraryRootRecordName } from "@flashcards/sync/cloud-library-bootstrap";
import {
  cloudLibraryZoneMarkerRecordName,
  readAdoptableDevelopmentCloudLibrary,
  replaceDevelopmentCloudLibrary,
} from "./development-cloud-reset";

const oldIdentity = {
  libraryId: "00000000-0000-4000-8000-000000000001",
  libraryGeneration: "00000000-0000-4000-8000-000000000002",
};
const nextIdentity = {
  libraryId: "00000000-0000-4000-8000-000000000003",
  libraryGeneration: "00000000-0000-4000-8000-000000000004",
};
const root = (identity: typeof oldIdentity) => ({
  ...identity,
  protocolVersion: 1,
  kind: "library-root" as const,
  deleted: false,
});
const atomicRoot = (identity: typeof oldIdentity) => ({
  ...identity,
  protocolVersion: 2,
  kind: "atomic-library" as const,
  serial: 0,
  deleted: false,
  pageCount: 0,
  lastPageSize: 0,
});

function fixture(
  records: Record<string, { value: unknown; changeTag: string }> = {},
) {
  const values = new Map(Object.entries(records));
  const compareAndSwap = vi.fn(
    async (name: string, expectedTag: string | null, value: unknown) => {
      const previous = values.get(name);
      if ((previous?.changeTag ?? null) !== expectedTag)
        throw new Error("conflict");
      values.set(name, {
        value,
        changeTag: `tag-${compareAndSwap.mock.calls.length}`,
      });
    },
  );
  const zones = new Map<string, { value: unknown; changeTag: string }>();
  const createZone = vi.fn(async () => undefined);
  const deleteZone = vi.fn(async () => undefined);
  const atomicStoreForIdentity = vi.fn((identity: typeof oldIdentity) => ({
    createZone,
    deleteZone,
    read: vi.fn(async (name: string) =>
      name === atomicCloudRootName
        ? (zones.get(identity.libraryGeneration) ?? null)
        : null,
    ),
    atomic: vi.fn(async () => undefined),
  }));
  const initialize = vi.fn(
    async (_store: unknown, identity: typeof oldIdentity) => {
      zones.set(identity.libraryGeneration, {
        value: atomicRoot(identity),
        changeTag: "atomic-tag",
      });
    },
  );
  const uuids = [nextIdentity.libraryId, nextIdentity.libraryGeneration];
  return {
    values,
    zones,
    compareAndSwap,
    createZone,
    deleteZone,
    initialize,
    input: {
      environment: "development" as const,
      oldIdentity,
      defaultStore: {
        read: async (name: string) => values.get(name) ?? null,
        compareAndSwap,
      },
      atomicStoreForIdentity,
      initialize,
      randomUUID: () => uuids.shift()!,
    },
  };
}

describe("development cloud reset", () => {
  it("validates a complete replacement generation without mutating cloud data", async () => {
    const f = fixture({
      [cloudLibraryRootRecordName]: {
        value: root(nextIdentity),
        changeTag: "root-next",
      },
      [cloudLibraryZoneMarkerRecordName]: {
        value: { ...nextIdentity, phase: "ready" },
        changeTag: "marker-next",
      },
    });
    f.zones.set(nextIdentity.libraryGeneration, {
      value: atomicRoot(nextIdentity),
      changeTag: "atomic-tag",
    });
    await expect(
      readAdoptableDevelopmentCloudLibrary(f.input),
    ).resolves.toEqual(nextIdentity);
    expect(f.compareAndSwap).not.toHaveBeenCalled();
    expect(f.createZone).not.toHaveBeenCalled();
    expect(f.deleteZone).not.toHaveBeenCalled();
  });

  it("rebuilds an externally reset empty development library", async () => {
    const f = fixture();
    await expect(replaceDevelopmentCloudLibrary(f.input)).resolves.toEqual({
      identity: nextIdentity,
      mode: "replaced",
    });
    expect(f.deleteZone).not.toHaveBeenCalled();
    expect(f.createZone).toHaveBeenCalledOnce();
    expect(f.values.get(cloudLibraryRootRecordName)?.value).toEqual(
      root(nextIdentity),
    );
    expect(f.values.get(cloudLibraryZoneMarkerRecordName)?.value).toEqual({
      ...nextIdentity,
      phase: "ready",
    });
  });

  it("deletes an intact old zone before replacing its generation", async () => {
    const f = fixture({
      [cloudLibraryRootRecordName]: {
        value: root(oldIdentity),
        changeTag: "root-old",
      },
      [cloudLibraryZoneMarkerRecordName]: {
        value: { ...oldIdentity, phase: "ready" },
        changeTag: "marker-old",
      },
    });
    await replaceDevelopmentCloudLibrary(f.input);
    expect(f.deleteZone).toHaveBeenCalledOnce();
    expect(f.createZone).toHaveBeenCalledOnce();
  });

  it("lets a stale second device adopt the already confirmed empty generation", async () => {
    const f = fixture({
      [cloudLibraryRootRecordName]: {
        value: root(nextIdentity),
        changeTag: "root-next",
      },
      [cloudLibraryZoneMarkerRecordName]: {
        value: { ...nextIdentity, phase: "ready" },
        changeTag: "marker-next",
      },
    });
    f.zones.set(nextIdentity.libraryGeneration, {
      value: atomicRoot(nextIdentity),
      changeTag: "atomic-tag",
    });
    await expect(replaceDevelopmentCloudLibrary(f.input)).resolves.toEqual({
      identity: nextIdentity,
      mode: "adopted",
    });
    expect(f.deleteZone).not.toHaveBeenCalled();
    expect(f.createZone).not.toHaveBeenCalled();
    expect(f.compareAndSwap).not.toHaveBeenCalled();
  });

  it("does not accept a remote generation without its confirmed custom-zone root", async () => {
    const f = fixture({
      [cloudLibraryRootRecordName]: {
        value: root(nextIdentity),
        changeTag: "root-next",
      },
      [cloudLibraryZoneMarkerRecordName]: {
        value: { ...nextIdentity, phase: "ready" },
        changeTag: "marker-next",
      },
    });
    await expect(replaceDevelopmentCloudLibrary(f.input)).rejects.toThrow(
      /zone is missing/,
    );
    expect(f.compareAndSwap).not.toHaveBeenCalled();
  });

  it("refuses to modify production", async () => {
    const f = fixture();
    await expect(
      replaceDevelopmentCloudLibrary({ ...f.input, environment: "production" }),
    ).rejects.toThrow(/production/);
    expect(f.createZone).not.toHaveBeenCalled();
  });
});
