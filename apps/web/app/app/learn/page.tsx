import { StudySession } from "../../../components/study-session";
import { studySessionIdentity } from "../../../components/study-navigation";

export const metadata = { title: "Study" };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ deckId?: string; practice?: string }>;
}) {
  const { deckId, practice } = await searchParams;
  return (
    <StudySession
      key={studySessionIdentity(deckId, practice === "all")}
      initialDeckId={deckId}
      initialPracticeAll={practice === "all"}
    />
  );
}
