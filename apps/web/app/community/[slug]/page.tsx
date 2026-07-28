import { CommunityDetail } from "../../../components/community-detail";
import { AuthenticatedPage } from "../../../components/authenticated-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: slug.replaceAll("-", " ") };
}
export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <AuthenticatedPage>
      <CommunityDetail slug={slug} />
    </AuthenticatedPage>
  );
}
