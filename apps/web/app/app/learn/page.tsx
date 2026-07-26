import { StudySession } from "../../../components/study-session";

export const metadata = { title: "Study" };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string; practice?: string }>;
}) {
  const { deckId, practice } = await searchParams;
  return (
    <StudySession
      initialDeckId={deckId}
      initialPracticeAll={practice === "all"}
    />
  );
}
