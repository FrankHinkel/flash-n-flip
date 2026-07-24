import { AuthForm } from "../../components/auth-form";
import { Brand } from "../../components/brand";

export const metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <main className="auth-page">
      <Brand className="auth-brand" />
      <section className="auth-panel">
        <span className="eyebrow">Willkommen zurück</span>
        <h1>Weiter wachsen.</h1>
        <p>Deine Lernkarten und dein Fortschritt warten auf dich.</p>
        <AuthForm mode="login" />
      </section>
      <aside className="auth-quote">
        <blockquote>
          „Die Wurzeln der Bildung sind bitter, aber ihre Früchte sind süß.“
        </blockquote>
        <span>Aristoteles</span>
      </aside>
    </main>
  );
}
