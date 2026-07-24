import { eq } from "drizzle-orm";

import { closeDatabase, db } from "../db/client.js";
import { userRoles, users } from "../db/schema.js";

const baseUrl = process.env.SMOKE_API_URL ?? "http://127.0.0.1:4000";
const suffix = Date.now().toString(36);
const authorEmail = `author-${suffix}@example.test`;
const learnerEmail = `learner-${suffix}@example.test`;
const password = "development-password-42";

type Json = Record<string, unknown>;

const request = async <T extends Json | Json[] | undefined>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> => {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed (${response.status}): ${await response.text()}`,
    );
  }
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
};

const post = <T extends Json | undefined>(
  path: string,
  body: unknown,
  token?: string,
) => request<T>(path, { method: "POST", body: JSON.stringify(body) }, token);

const register = (email: string, displayName: string) =>
  post<{
    accessToken: string;
    user: { id: string };
  }>("/auth/register", {
    email,
    password,
    displayName,
    locale: "de",
    deviceName: "API smoke test",
    termsVersion: "smoke",
    privacyVersion: "smoke",
  });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  const author = await register(authorEmail, "Smoke Author");
  await db
    .insert(userRoles)
    .values({ userId: author.user.id, role: "ADMIN" })
    .onConflictDoNothing();
  const login = await post<{
    accessToken: string;
  }>("/auth/login", {
    email: authorEmail,
    password,
    deviceName: "API smoke admin",
  });
  const adminToken = login.accessToken;

  const deck = await post<{ id: string }>(
    "/decks",
    {
      title: `Immutable Biology ${suffix}`,
      description: "Integration test deck",
      language: "de",
      tags: ["smoke", "biology"],
    },
    adminToken,
  );
  const first = await post<{ id: string; version: number }>(
    `/decks/${deck.id}/cards`,
    {
      front: { blocks: [{ type: "text", text: "Original question" }] },
      back: { blocks: [{ type: "text", text: "Original answer" }] },
      tags: ["cell"],
    },
    adminToken,
  );
  await post(
    `/decks/${deck.id}/cards`,
    {
      front: { blocks: [{ type: "text", text: "Second question" }] },
      back: { blocks: [{ type: "text", text: "Second answer" }] },
      tags: [],
    },
    adminToken,
  );

  const due = await request<Array<{ card: { id: string } }>>(
    `/study/due?deckId=${deck.id}`,
    {},
    adminToken,
  );
  assert(due.length === 2, "Author should have two due private cards");
  const mutationId = crypto.randomUUID();
  const reviewInput = {
    mutationId,
    cardId: first.id,
    rating: "GOOD",
    reviewedAt: new Date().toISOString(),
    timezone: "Europe/Berlin",
  };
  await post("/study/review", reviewInput, adminToken);
  const duplicate = await post<{ duplicate: boolean }>(
    "/study/review",
    reviewInput,
    adminToken,
  );
  assert(duplicate.duplicate, "Review mutation must be idempotent");

  const submitted = await post<{
    publicationId: string;
    revisionId: string;
  }>(
    `/decks/${deck.id}/submit`,
    {
      category: "Naturwissenschaften",
      sources: [
        {
          label: "Integration test source",
          license: "CC BY 4.0",
          url: "https://example.test/source",
        },
      ],
    },
    adminToken,
  );
  for (const [nextStatus, reason] of [
    ["IN_REVIEW", "Smoke review started"],
    ["APPROVED", "Smoke sources and cards checked"],
    ["PUBLISHED", "Smoke publication approved"],
  ] as const) {
    await post(
      `/moderation/${submitted.publicationId}/transition`,
      { nextStatus, reason },
      adminToken,
    );
  }

  const publicDecks =
    await request<Array<{ id: string; slug: string }>>("/community/decks");
  const publicDeck = publicDecks.find(
    (item) => item.id === submitted.publicationId,
  );
  assert(publicDeck, "Approved deck must be publicly discoverable");

  const learner = await register(learnerEmail, "Smoke Learner");
  await post(
    `/community/${submitted.publicationId}/subscribe`,
    {},
    learner.accessToken,
  );
  const learnerDue = await request<
    Array<{ card: { id: string; front: { blocks: Array<{ text?: string }> } } }>
  >(`/study/due?deckId=${deck.id}`, {}, learner.accessToken);
  assert(learnerDue.length === 2, "Subscriber should receive revision cards");
  assert(
    learnerDue.every((item) => item.card.id !== first.id),
    "Subscriber must not learn from mutable author card IDs",
  );

  await request(
    `/decks/${deck.id}/cards/${first.id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        version: first.version,
        front: { blocks: [{ type: "text", text: "Changed private question" }] },
        back: { blocks: [{ type: "text", text: "Changed private answer" }] },
        tags: [],
      }),
    },
    adminToken,
  );
  const learnerAfterEdit = await request<
    Array<{ card: { front: { blocks: Array<{ text?: string }> } } }>
  >(`/study/due?deckId=${deck.id}`, {}, learner.accessToken);
  assert(
    learnerAfterEdit.some(
      (item) => item.card.front.blocks[0]?.text === "Original question",
    ),
    "Published revision must remain unchanged after private edits",
  );

  await post(
    `/community/${submitted.publicationId}/reports`,
    {
      category: "INCORRECT",
      details: "Integration test report with enough explanatory detail.",
    },
    learner.accessToken,
  );
  const reports = await request<Array<{ report: { id: string } }>>(
    "/moderation/reports",
    {},
    adminToken,
  );
  assert(reports.length > 0, "Admin must see open content reports");

  const [storedAuthor] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, author.user.id));
  assert(storedAuthor?.email === authorEmail, "Author must be persisted");

  console.log(
    JSON.stringify({
      ok: true,
      deckId: deck.id,
      revisionId: submitted.revisionId,
      publicationId: submitted.publicationId,
      assertions: 8,
    }),
  );
} finally {
  await closeDatabase();
}
