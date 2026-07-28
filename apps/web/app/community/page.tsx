import { CommunityBrowser } from "../../components/community-browser";
import { AuthenticatedPage } from "../../components/authenticated-page";

export const metadata = { title: "Discover community decks" };
export default function CommunityPage() {
  return (
    <AuthenticatedPage>
      <CommunityBrowser />
    </AuthenticatedPage>
  );
}
