import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CloudOff,
  Layers3,
  Sparkles,
} from "lucide-react";

import { Brand } from "../components/brand";
import { CommunityPreview } from "../components/community-preview";
import { DemoCard } from "../components/demo-card";

export default function Home() {
  return (
    <main>
      <header className="landing-nav">
        <Brand />
        <nav aria-label="Hauptnavigation">
          <Link href="#community">Entdecken</Link>
          <Link href="#method">Methode</Link>
          <Link className="button button-quiet" href="/login">
            Anmelden
          </Link>
          <Link className="button button-primary" href="/register">
            Kostenlos starten
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} /> Für neugierige Köpfe
          </span>
          <h1>
            Wissen wächst,
            <br />
            wenn du es <em>pflegst.</em>
          </h1>
          <p>
            Erstelle wunderschöne Lernkarten. Flora plant deine Wiederholungen
            genau dann, wenn dein Gedächtnis sie braucht.
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary button-large"
              href="/register"
            >
              Jetzt loslernen <ArrowRight size={18} />
            </Link>
            <Link
              className="button button-quiet button-large"
              href="/community"
            >
              Lernsets entdecken
            </Link>
          </div>
          <small>Kostenlos · Kein Abo nötig · Deine Daten gehören dir</small>
        </div>

        <div className="hero-visual" aria-label="Vorschau einer Lernkarte">
          <div className="float-chip chip-one">Heute: 24 Karten</div>
          <div className="float-chip chip-two">+12 Tage</div>
          <div className="demo-card card-back" />
          <DemoCard />
        </div>
      </section>

      <section className="trust-strip" id="method">
        <article>
          <span>
            <Layers3 />
          </span>
          <div>
            <strong>Weniger pauken</strong>
            <p>FSRS plant effiziente Wiederholungen.</p>
          </div>
        </article>
        <article>
          <span>
            <CloudOff />
          </span>
          <div>
            <strong>Überall lernen</strong>
            <p>Offline auf iOS, Android und im Web.</p>
          </div>
        </article>
        <article>
          <span>
            <BadgeCheck />
          </span>
          <div>
            <strong>Geprüfte Inhalte</strong>
            <p>Community-Decks werden vor Veröffentlichung geprüft.</p>
          </div>
        </article>
      </section>

      <section className="community-section" id="community">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Von der Community</span>
            <h2>Entdecke Wissen, das schon auf dich wartet.</h2>
          </div>
          <Link className="text-link" href="/community">
            Alle Lernsets <ArrowRight size={17} />
          </Link>
        </div>
        <CommunityPreview />
      </section>

      <footer>
        <Brand />
        <p>© 2026 Flora · Lernen, das bleibt.</p>
        <nav aria-label="Rechtliches">
          <Link href="/legal/privacy">Datenschutz</Link>
          <Link href="/legal/terms">Nutzungsbedingungen</Link>
          <Link href="/legal/imprint">Impressum</Link>
        </nav>
      </footer>
    </main>
  );
}
