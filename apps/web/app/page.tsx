"use client";

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
import { useI18n } from "../components/i18n-provider";

export default function Home() {
  const { text } = useI18n();
  return (
    <main>
      <header className="landing-nav">
        <Brand />
        <nav aria-label={text("Main navigation", "Hauptnavigation")}>
          <Link href="#community">{text("Discover", "Entdecken")}</Link>
          <Link href="#method">{text("Method", "Methode")}</Link>
          <Link className="button button-quiet" href="/login">
            {text("Sign in", "Anmelden")}
          </Link>
          <Link className="button button-primary" href="/register">
            {text("Start for free", "Kostenlos starten")}
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={15} />{" "}
            {text("For curious minds", "Für neugierige Köpfe")}
          </span>
          <h1>
            {text("Knowledge grows", "Wissen wächst")},
            <br />
            {text("when you ", "wenn du es ")}
            <em>{text("flip it.", "pflegst.")}</em>
          </h1>
          <p>
            {text(
              "Create beautiful flashcards. Flash-n-Flip schedules reviews exactly when your memory needs them.",
              "Erstelle wunderschöne Lernkarten. Flash-n-Flip plant deine Wiederholungen genau dann, wenn dein Gedächtnis sie braucht.",
            )}
          </p>
          <div className="hero-actions">
            <Link
              className="button button-primary button-large"
              href="/register"
            >
              {text("Start studying", "Jetzt loslernen")}{" "}
              <ArrowRight size={18} />
            </Link>
            <Link
              className="button button-quiet button-large"
              href="/community"
            >
              {text("Discover decks", "Lernsets entdecken")}
            </Link>
          </div>
          <small>
            {text(
              "Free · No subscription required · Your data belongs to you",
              "Kostenlos · Kein Abo nötig · Deine Daten gehören dir",
            )}
          </small>
        </div>

        <div
          className="hero-visual"
          aria-label={text("Flashcard preview", "Vorschau einer Lernkarte")}
        >
          <div className="float-chip chip-one">
            {text("Today: 24 cards", "Heute: 24 Karten")}
          </div>
          <div className="float-chip chip-two">
            {text("+12 days", "+12 Tage")}
          </div>
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
            <strong>{text("Study less", "Weniger pauken")}</strong>
            <p>
              {text(
                "FSRS schedules efficient reviews.",
                "FSRS plant effiziente Wiederholungen.",
              )}
            </p>
          </div>
        </article>
        <article>
          <span>
            <CloudOff />
          </span>
          <div>
            <strong>{text("Study anywhere", "Überall lernen")}</strong>
            <p>
              {text(
                "Offline on iOS, Android, and the web.",
                "Offline auf iOS, Android und im Web.",
              )}
            </p>
          </div>
        </article>
        <article>
          <span>
            <BadgeCheck />
          </span>
          <div>
            <strong>{text("Reviewed content", "Geprüfte Inhalte")}</strong>
            <p>
              {text(
                "Community decks are reviewed before publication.",
                "Community-Decks werden vor Veröffentlichung geprüft.",
              )}
            </p>
          </div>
        </article>
      </section>

      <section className="community-section" id="community">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {text("From the community", "Von der Community")}
            </span>
            <h2>
              {text(
                "Discover knowledge waiting for you.",
                "Entdecke Wissen, das schon auf dich wartet.",
              )}
            </h2>
          </div>
          <Link className="text-link" href="/community">
            {text("All decks", "Alle Lernsets")} <ArrowRight size={17} />
          </Link>
        </div>
        <CommunityPreview />
      </section>

      <footer>
        <Brand />
        <p>© 2026 Flash-n-Flip · Flash, Flip and Remember.</p>
        <nav aria-label={text("Legal", "Rechtliches")}>
          <Link href="/legal/privacy">{text("Privacy", "Datenschutz")}</Link>
          <Link href="/legal/terms">
            {text("Terms of use", "Nutzungsbedingungen")}
          </Link>
          <Link href="/legal/imprint">{text("Imprint", "Impressum")}</Link>
        </nav>
      </footer>
    </main>
  );
}
