import { RoutedStudySession } from "../../../components/routed-study-session";
import { studySessionIdentity } from "../../../components/study-navigation";

export const metadata = { title: "Study" };

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{
    deckId?: string;
    practice?: string;
    direction?: string;
  }>;
}) {
  const { deckId, practice, direction } = await searchParams;
  return (
    <RoutedStudySession
      key={studySessionIdentity(deckId, practice === "all", direction)}
      initialDeckId={deckId}
      initialPracticeAll={practice === "all"}
      initialDirection={direction}
    />
  );
}
