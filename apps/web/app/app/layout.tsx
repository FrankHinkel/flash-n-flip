import { Suspense } from "react";

import { AppShell } from "../../components/app-shell";

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="auth-check" aria-busy="true">
          <span className="sr-only">Loading application …</span>
        </main>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
