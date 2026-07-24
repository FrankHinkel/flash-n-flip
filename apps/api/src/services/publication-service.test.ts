import { describe, expect, it } from "vitest";

import { PublicationService } from "./publication-service.js";
import type {
  ModerationAudit,
  PublicationRecord,
  PublicationRepository,
} from "./publication-service.js";

class FakeRepository implements PublicationRepository {
  publication: PublicationRecord = {
    id: "019cfcf4-7285-7db3-936e-e652577464d8",
    deckId: "019cfcf4-7285-7db3-936e-e652577464d9",
    revisionId: "019cfcf4-7285-7db3-936e-e652577464da",
    status: "IN_REVIEW",
    slug: "deutsch-a1",
  };
  decisions: ModerationAudit[] = [];
  audits: Array<Record<string, unknown>> = [];

  async find(): Promise<PublicationRecord> {
    return this.publication;
  }

  async commitTransition(
    input: Parameters<PublicationRepository["commitTransition"]>[0],
  ): Promise<void> {
    this.publication = {
      ...this.publication,
      revisionId: input.revisionId,
      status: input.status,
    };
    this.decisions.push(input.decision);
    this.audits.push(input.audit);
  }
}

describe("PublicationService", () => {
  it("blocks approval by a non-admin", async () => {
    const repository = new FakeRepository();
    const service = new PublicationService(repository);

    await expect(
      service.transition({
        publicationId: repository.publication.id,
        actorId: "019cfcf4-7285-7db3-936e-e652577464db",
        actorRoles: ["REVIEWER"],
        nextStatus: "APPROVED",
        reason: "Reviewed",
      }),
    ).rejects.toThrow(/Admin/);
  });

  it("records an admin approval and audit entry", async () => {
    const repository = new FakeRepository();
    const service = new PublicationService(repository);

    await service.transition({
      publicationId: repository.publication.id,
      actorId: "019cfcf4-7285-7db3-936e-e652577464db",
      actorRoles: ["ADMIN"],
      nextStatus: "APPROVED",
      reason: "Sources and cards reviewed",
    });

    expect(repository.publication.status).toBe("APPROVED");
    expect(repository.decisions).toHaveLength(1);
    expect(repository.audits).toHaveLength(1);
  });

  it("rejects publishing before approval", async () => {
    const repository = new FakeRepository();
    const service = new PublicationService(repository);

    await expect(
      service.transition({
        publicationId: repository.publication.id,
        actorId: "019cfcf4-7285-7db3-936e-e652577464db",
        actorRoles: ["ADMIN"],
        nextStatus: "PUBLISHED",
        reason: "Attempted bypass",
      }),
    ).rejects.toThrow(/Invalid publication transition/);
  });
});
