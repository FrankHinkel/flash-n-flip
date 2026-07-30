import type { Metadata } from "next";

import { OnlineHelp } from "../../../components/online-help";

export const metadata: Metadata = {
  title: "Help",
  description: "Flash-n-Flip online help",
};

export default function HelpPage() {
  return <OnlineHelp />;
}
