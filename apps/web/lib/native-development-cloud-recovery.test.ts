import { describe, expect, it, vi } from "vitest";
import {
  adoptDevelopmentCloudLibraryBinding,
  type CloudLibraryBindingRepository,
} from "@flashcards/sync/cloud-library-bootstrap";
import type { CloudLibraryBinding } from "@flashcards/domain/cloud-library";
import { atomicCloudRootName } from "@flashcards/sync/cloud-library-atomic";
import { cloudLibraryRootRecordName } from "@flashcards/sync/cloud-library-bootstrap";
import { cloudLibraryZoneMarkerRecordName } from "./development-cloud-reset";
import { recoverNativeDevelopmentCloudBinding } from "./native-development-cloud-recovery";

const oldRoot = {
  libraryId: "00000000-0000-4000-8000-000000000001",
  libraryGeneration: "00000000-0000-4000-8000-000000000002",
  protocolVersion: 1 as const,
  kind: "library-root" as const,
  deleted: false,
};
const nextRoot = {
  ...oldRoot,
  libraryId: "00000000-0000-4000-8000-000000000003",
  libraryGeneration: "00000000-0000-4000-8000-000000000004",
};

function fixture() {
  let binding: CloudLibraryBinding = {
    environment: "development" as const,
    account: "account-a",
    phase: "bound" as const,
    root: oldRoot,
  };
  const adoptDevelopment = vi.fn(async (expected, root) => {
    binding = adoptDevelopmentCloudLibraryBinding(binding, expected, root);
  });
  const bindings: CloudLibraryBindingRepository = {
    read: vi.fn(async () => binding),
    reserve: vi.fn(),
    confirm: vi.fn(),
    adoptDevelopment,
  };
  const records = new Map([
    [cloudLibraryRootRecordName, { value: nextRoot, changeTag: "root-tag" }],
    [
      cloudLibraryZoneMarkerRecordName,
      {
        value: {
          libraryId: nextRoot.libraryId,
          libraryGeneration: nextRoot.libraryGeneration,
          phase: "ready",
        },
        changeTag: "marker-tag",
      },
    ],
  ]);
  return {
    bindings,
    adoptDevelopment,
    input: {
      allowed: true,
      cause: { code: "ROOT_CHANGED" },
      environment: "development" as const,
      account: "account-a",
      bindings,
      defaultStore: {
        read: vi.fn(async (name: string) => records.get(name) ?? null),
        compareAndSwap: vi.fn(),
      },
      atomicStoreForIdentity: vi.fn(() => ({
        createZone: vi.fn(),
        deleteZone: vi.fn(),
        atomic: vi.fn(),
        read: vi.fn(async (name: string) =>
          name === atomicCloudRootName
            ? {
                value: {
                  libraryId: nextRoot.libraryId,
                  libraryGeneration: nextRoot.libraryGeneration,
                  protocolVersion: 2,
                  kind: "atomic-library",
                  serial: 0,
                  deleted: false,
                  pageCount: 0,
                  lastPageSize: 0,
                },
                changeTag: "atomic-tag",
              }
            : null,
        ),
      })),
    },
  };
}

describe("native development cloud recovery", () => {
  it("adopts a fully confirmed reset generation without deleting local data", async () => {
    const f = fixture();
    await expect(
      recoverNativeDevelopmentCloudBinding(f.input),
    ).resolves.toEqual(nextRoot);
    expect(f.adoptDevelopment).toHaveBeenCalledOnce();
    expect(await f.bindings.read("development")).toMatchObject({
      root: nextRoot,
    });
  });

  it("does not recover production, web or unrelated failures", async () => {
    const f = fixture();
    await expect(
      recoverNativeDevelopmentCloudBinding({
        ...f.input,
        allowed: false,
      }),
    ).resolves.toBeNull();
    await expect(
      recoverNativeDevelopmentCloudBinding({
        ...f.input,
        cause: { code: "SERVICE_UNAVAILABLE" },
      }),
    ).resolves.toBeNull();
    expect(f.adoptDevelopment).not.toHaveBeenCalled();
  });
});
