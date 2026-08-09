import { redirect } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: slug.replaceAll("-", " ") };
}
export default async function CommunityDetailPage({
  params: _params,
}: {
  params: Promise<{ slug: string }>;
}) {
  redirect("/community");
}
