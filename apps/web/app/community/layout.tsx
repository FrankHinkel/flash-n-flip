import { Suspense } from "react";

import { AppShell } from "../../components/app-shell";
import { LocalizedLoadingStatus } from "../../components/localized-loading-status";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LocalizedLoadingStatus />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
