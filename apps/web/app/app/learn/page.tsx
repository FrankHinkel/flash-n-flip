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
    xefjordQuestionEnglish?: string;
    xefjordAnswerEnglish?: string;
    plan?: string;
    mode?: string;
    ratings?: string;
  }>;
}) {
  const {
    deckId,
    practice,
    direction,
    xefjordSourceDeckId,
    xefjordTargetDeckId,
    xefjordMode,
    xefjordQuestionEnglish,
    xefjordAnswerEnglish,
    plan,
    mode,
    ratings,
  } = await searchParams;
  return (
    <RoutedStudySession
      key={`${studySessionIdentity(
        deckId,
        practice === "all",
        direction,
        xefjordSourceDeckId,
        xefjordTargetDeckId,
        xefjordMode,
        xefjordQuestionEnglish === "true",
        xefjordAnswerEnglish === "true",
      )}${plan === "today" ? ":today" : ""}${mode ? `:${mode}:${ratings ?? ""}` : ""}`}
      initialDeckId={deckId}
      initialPracticeAll={practice === "all"}
      initialDirection={direction}
      initialXefjordSourceDeckId={xefjordSourceDeckId}
      initialXefjordTargetDeckId={xefjordTargetDeckId}
      initialXefjordMode={xefjordMode}
      initialXefjordQuestionEnglish={xefjordQuestionEnglish === "true"}
      initialXefjordAnswerEnglish={xefjordAnswerEnglish === "true"}
      initialTodayPlan={plan === "today"}
    />
  );
}
