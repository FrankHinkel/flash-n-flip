import { redirect } from "next/navigation";

export const metadata = {
  title: "Install Flash-n-Flip PWA",
  robots: { index: false, follow: false },
};

export default function PwaEntryPage() {
  redirect("/app");
}
