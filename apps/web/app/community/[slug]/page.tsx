import { CommunityDetail } from "../../../components/community-detail";

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
  return <CommunityDetail slug={slug} />;
}
