import { v7 as uuidv7 } from "uuid";
import { z } from "zod";

export const roleSchema = z.enum(["USER", "AUTHOR", "REVIEWER", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

export const publicationStatusSchema = z.enum([
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "SUSPENDED",
  "ARCHIVED",
]);
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

export const ratingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export type ReviewRating = z.infer<typeof ratingSchema>;

export const cardStateSchema = z.object({
  due: z.string().datetime(),
  stability: z.number().nonnegative(),
  difficulty: z.number().min(0).max(10),
  elapsedDays: z.number().int().nonnegative(),
  scheduledDays: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  learningState: z.enum(["NEW", "LEARNING", "REVIEW", "RELEARNING"]),
  lastReview: z.string().datetime().nullable(),
});
export type CardState = z.infer<typeof cardStateSchema>;

export const reviewEventSchema = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  userId: z.uuid(),
  cardId: z.uuid(),
  reviewedAt: z.string().datetime(),
  timezone: z.string().min(1),
  rating: ratingSchema,
  schedulerVersion: z.string().min(1),
  parameters: z.array(z.number()),
  before: cardStateSchema,
  after: cardStateSchema,
});
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

export const deckSummarySchema = z.object({
  id: z.uuid(),
  parentDeckId: z.uuid().nullable(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000),
  language: z.string().trim().min(2).max(16),
  contentLocales: z.array(z.string().trim().min(2).max(16)).min(1).max(20),
  defaultContentLocale: z.string().trim().min(2).max(16),
  protectionMode: z.enum(["STANDARD", "ACCOUNT_BOUND"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  favorite: z.boolean(),
  sourceTemplateKey: z.string().nullable(),
  cardCount: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});
export type DeckSummary = z.infer<typeof deckSummarySchema>;

export {
  europeContentLocales,
  europeCountries,
  getEuropeCountry,
  getEuropeCountryName,
} from "@flashcards/domain/europe-countries";
export type {
  EuropeContentLocale,
  EuropeCountryCode,
} from "@flashcards/domain/europe-countries";
export {
  europeMapShapes,
  europeMapViewBox,
} from "@flashcards/domain/europe-map";
export {
  geographyContentLocales,
  geographyMapIds,
  geographyMaps,
  geographyRegions,
  getGeographyRegion,
  getGeographyRegionName,
} from "@flashcards/domain/geography";
export type {
  GeographyContentLocale,
  GeographyMapId,
} from "@flashcards/domain/geography";

export const syncMutationSchema = z.object({
  mutationId: z.uuid(),
  entityId: z.uuid(),
  entityType: z.enum(["DECK", "NOTE", "CARD", "REVIEW", "SUBSCRIPTION"]),
  operation: z.enum(["UPSERT", "DELETE"]),
  baseVersion: z.number().int().nonnegative().nullable(),
  payload: z.unknown(),
  createdAt: z.string().datetime(),
});
export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const createId = (): string => uuidv7();

export const assertAdmin = (roles: readonly Role[]): void => {
  if (!roles.includes("ADMIN")) {
    throw new Error("Admin role required");
  }
};
