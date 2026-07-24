import { assertAdmin, createId } from "@flashcards/domain";
import type { PublicationStatus, Role } from "@flashcards/domain";

export type PublicationRecord = {
  id: string;
  deckId: string;
  revisionId: string | null;
  status: PublicationStatus;
  slug: string;
};

export type ModerationAudit = {
  id: string;
  publicationId: string;
  revisionId: string | null;
  actorId: string;
  previousStatus: PublicationStatus;
  nextStatus: PublicationStatus;
  reason: string;
};

export interface PublicationRepository {
  find(publicationId: string): Promise<PublicationRecord | null>;
  commitTransition(input: {
    publicationId: string;
    revisionId: string | null;
    status: PublicationStatus;
    decision: ModerationAudit;
    audit: {
      id: string;
      actorId: string;
      action: string;
      entityId: string;
      reason: string;
      metadata: Record<string, unknown>;
    };
  }): Promise<void>;
}

const allowedTransitions: Record<PublicationStatus, PublicationStatus[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["IN_REVIEW", "CHANGES_REQUESTED"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED"],
  CHANGES_REQUESTED: ["SUBMITTED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["PUBLISHED", "ARCHIVED"],
  ARCHIVED: [],
};

const adminOnlyStatuses: PublicationStatus[] = [
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "SUSPENDED",
  "ARCHIVED",
];

export class PublicationService {
  constructor(private readonly repository: PublicationRepository) {}

  async transition(input: {
    publicationId: string;
    revisionId?: string | null;
    actorId: string;
    actorRoles: Role[];
    nextStatus: PublicationStatus;
    reason: string;
  }): Promise<void> {
    const publication = await this.repository.find(input.publicationId);
    if (!publication) {
      throw Object.assign(new Error("Publication not found"), {
        statusCode: 404,
      });
    }

    if (!allowedTransitions[publication.status].includes(input.nextStatus)) {
      throw Object.assign(
        new Error(
          `Invalid publication transition ${publication.status} -> ${input.nextStatus}`,
        ),
        { statusCode: 409 },
      );
    }

    if (adminOnlyStatuses.includes(input.nextStatus)) {
      assertAdmin(input.actorRoles);
    }

    const revisionId = input.revisionId ?? publication.revisionId;
    if (
      ["SUBMITTED", "IN_REVIEW", "APPROVED", "PUBLISHED"].includes(
        input.nextStatus,
      ) &&
      !revisionId
    ) {
      throw Object.assign(new Error("A revision is required"), {
        statusCode: 409,
      });
    }

    const decision: ModerationAudit = {
      id: createId(),
      publicationId: publication.id,
      revisionId,
      actorId: input.actorId,
      previousStatus: publication.status,
      nextStatus: input.nextStatus,
      reason: input.reason,
    };
    await this.repository.commitTransition({
      publicationId: publication.id,
      revisionId,
      status: input.nextStatus,
      decision,
      audit: {
        id: createId(),
        actorId: input.actorId,
        action: `publication.${input.nextStatus.toLowerCase()}`,
        entityId: publication.id,
        reason: input.reason,
        metadata: {
          previousStatus: publication.status,
          nextStatus: input.nextStatus,
          revisionId,
        },
      },
    });
  }
}
