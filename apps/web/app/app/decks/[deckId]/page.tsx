import { DeckEditor } from "../../../../components/deck-editor";

export const metadata = { title: "Edit deck" };
export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <DeckEditor deckId={deckId} />;
}
