import { StudySession } from "../../../components/study-session";

export const metadata = { title: "Lernen" };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string }>;
}) {
  const { deckId } = await searchParams;
  return <StudySession initialDeckId={deckId} />;
}
