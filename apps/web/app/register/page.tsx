import Link from "next/link";

import { AuthForm } from "../../components/auth-form";
import { Brand } from "../../components/brand";

export const metadata = { title: "Konto erstellen" };

export default function RegisterPage() {
  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/">
        <Brand />
      </Link>
      <section className="auth-panel">
        <span className="eyebrow">Dein Lernraum</span>
        <h1>Heute anfangen. Lange erinnern.</h1>
        <p>Erstelle dein kostenloses Flora-Konto.</p>
        <AuthForm mode="register" />
      </section>
      <aside className="auth-quote auth-illustration">
        <span className="orbit orbit-a" />
        <span className="orbit orbit-b" />
        <strong>kleine Schritte</strong>
        <em>großes Wissen</em>
      </aside>
    </main>
  );
}
