import { notFound } from "next/navigation";

import { AuthenticatedPage } from "../../../components/authenticated-page";
import { LegalDocument } from "../../../components/legal-document";

const documentNames = ["privacy", "terms", "imprint"] as const;

export default async function LegalPage({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const { document } = await params;
  if (!documentNames.includes(document as (typeof documentNames)[number]))
    notFound();
  return (
    <AuthenticatedPage>
      <LegalDocument document={document as (typeof documentNames)[number]} />
    </AuthenticatedPage>
  );
}
