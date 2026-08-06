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
    xefjordSourceDeckId?: string;
    xefjordTargetDeckId?: string;
    xefjordMode?: string;
  }>;
}) {
  const {
    deckId,
    practice,
    direction,
    xefjordSourceDeckId,
    xefjordTargetDeckId,
    xefjordMode,
  } = await searchParams;
  return (
    <RoutedStudySession
      key={studySessionIdentity(
        deckId,
        practice === "all",
        direction,
        xefjordSourceDeckId,
        xefjordTargetDeckId,
        xefjordMode,
      )}
      initialDeckId={deckId}
      initialPracticeAll={practice === "all"}
      initialDirection={direction}
      initialXefjordSourceDeckId={xefjordSourceDeckId}
      initialXefjordTargetDeckId={xefjordTargetDeckId}
      initialXefjordMode={xefjordMode}
    />
  );
}
