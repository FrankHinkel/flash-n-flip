import { describe, expect, it } from "vitest";

import {
  planDeckHierarchyTransferMerge,
  planDeckTransferMerge,
} from "./deck-transfer-merge.js";

const local = {
  id: "019fdbc4-e52b-706b-ad54-9b8c051828d6",
  title: "Deutsch A1",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

describe("deck transfer merge planning", () => {
  it("updates the sole equal-name deck only when the incoming copy is newer", () => {
    expect(
      planDeckTransferMerge(
        [local],
        [
          {
            id: "019fdbc4-e52b-706b-ad54-9b8c051828d7",
            title: "  DEUTSCH   A1 ",
            updatedAt: "2026-08-02T10:00:00.000Z",
          },
        ],
      )[0],
    ).toMatchObject({ action: "UPDATE", targetDeckId: local.id });
    expect(
      planDeckTransferMerge(
        [local],
        [{ ...local, updatedAt: "2026-08-01T10:00:00.000Z" }],
      )[0],
    ).toMatchObject({ action: "IGNORE", reason: "SAME_OR_OLDER" });
    expect(
      planDeckTransferMerge(
        [local],
        [{ ...local, updatedAt: "2026-07-31T10:00:00.000Z" }],
      )[0],
    ).toMatchObject({ action: "IGNORE", reason: "SAME_OR_OLDER" });
  });

  it("inserts new names and refuses ambiguous names", () => {
    const incoming = {
      id: "019fdbc4-e52b-706b-ad54-9b8c051828d7",
      title: "Isländisch",
      updatedAt: "2026-08-02T10:00:00.000Z",
    };
    expect(planDeckTransferMerge([local], [incoming])[0]).toMatchObject({
      action: "INSERT",
      targetDeckId: incoming.id,
    });
    expect(
      planDeckTransferMerge(
        [local, { ...local, id: incoming.id }],
        [
          {
            ...incoming,
            id: "019fdbc4-e52b-706b-ad54-9b8c051828d8",
            title: local.title,
          },
        ],
      )[0],
    ).toMatchObject({ action: "IGNORE", reason: "AMBIGUOUS" });
  });

  it("refuses an incoming id that already belongs to another name", () => {
    expect(
      planDeckTransferMerge(
        [local],
        [
          {
            id: local.id,
            title: "Isländisch",
            updatedAt: "2026-08-02T10:00:00.000Z",
          },
        ],
      )[0],
    ).toMatchObject({ action: "IGNORE", reason: "ID_COLLISION" });
  });

  it("repairs an empty equal-name shell with a non-empty incoming deck", () => {
    expect(
      planDeckTransferMerge(
        [{ ...local, cardCount: 0 }],
        [
          {
            ...local,
            id: "019fdbc4-e52b-706b-ad54-9b8c051828d9",
            updatedAt: "2026-07-31T10:00:00.000Z",
            cardCount: 24,
          },
        ],
      )[0],
    ).toMatchObject({ action: "UPDATE", targetDeckId: local.id });
  });

  it("matches repeated child names within their resolved collection branch", () => {
    const localCollectionA = {
      ...local,
      id: "019fdbc4-e52b-706b-ad54-9b8c051828a1",
      parentDeckId: null,
      title: "Collection A",
    };
    const localCollectionB = {
      ...local,
      id: "019fdbc4-e52b-706b-ad54-9b8c051828b1",
      parentDeckId: null,
      title: "Collection B",
    };
    const localChildA = {
      ...local,
      id: "019fdbc4-e52b-706b-ad54-9b8c051828a2",
      parentDeckId: localCollectionA.id,
      title: "Vocabulary",
    };
    const localChildB = {
      ...local,
      id: "019fdbc4-e52b-706b-ad54-9b8c051828b2",
      parentDeckId: localCollectionB.id,
      title: "Vocabulary",
    };
    const incomingCollection = {
      ...localCollectionA,
      id: "019fdbc4-e52b-706b-ad54-9b8c051828c1",
      updatedAt: "2026-08-02T10:00:00.000Z",
    };
    const incomingChild = {
      ...localChildA,
      id: "019fdbc4-e52b-706b-ad54-9b8c051828c2",
      parentDeckId: incomingCollection.id,
      updatedAt: "2026-08-02T10:00:00.000Z",
    };

    expect(
      planDeckHierarchyTransferMerge(
        [localCollectionA, localCollectionB, localChildA, localChildB],
        [incomingChild, incomingCollection],
      ),
    ).toEqual([
      expect.objectContaining({
        incomingDeckId: incomingCollection.id,
        targetDeckId: localCollectionA.id,
        action: "UPDATE",
      }),
      expect.objectContaining({
        incomingDeckId: incomingChild.id,
        targetDeckId: localChildA.id,
        action: "UPDATE",
      }),
    ]);
  });
});
