import type { Metadata } from "next";
import Link from "next/link";

import styles from "./pianoforte.module.css";

export const metadata: Metadata = {
  title: "Pianoforte — piano practice with real sheet music",
  description:
    "A calm, free piano-practice companion for iPhone and iPad. Learn from sheet music, falling notes and optional MIDI, at your own pace.",
  alternates: { canonical: "/pianoforte" },
};

export default function PianofortePage() {
  return (
    <main id="main" className={styles.main}>
      <section className={styles.hero} aria-labelledby="pianoforte-title">
        <div>
          <p className={styles.eyebrow}>A quieter way to practise piano</p>
          <h1 id="pianoforte-title">
            Music first.
            <br />
            Practice at your pace.
          </h1>
          <p className={styles.lead}>
            Pianoforte puts a readable score, a falling-notes view and your
            piano in one focused place. Repeat a passage, slow it down, and hear
            your progress — without an account or subscription.
          </p>
          <p className={styles.availability}>
            Free app for iPhone and iPad · App Store release in preparation
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryLink} href="/pianoforte/support">
              Contact &amp; support
            </Link>
            <a className={styles.secondaryLink} href="/">
              Discover Flash-n-Flip ↗
            </a>
          </div>
        </div>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.artHeading}>PIANOFORTE</div>
          <div className={styles.staff}>
            <span>♪</span>
            <span>♩</span>
            <span>♫</span>
          </div>
          <div className={styles.waterfall}>
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className={styles.keys}>
            {Array.from({ length: 12 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
      </section>
      <section className={styles.features} aria-label="What Pianoforte offers">
        <article>
          <span aria-hidden="true">01</span>
          <h2>See the music</h2>
          <p>Read the score, switch to falling notes, or keep both in view.</p>
        </article>
        <article>
          <span aria-hidden="true">02</span>
          <h2>Stay with a passage</h2>
          <p>Slow the tempo, set an A/B loop and practise one or both hands.</p>
        </article>
        <article>
          <span aria-hidden="true">03</span>
          <h2>Connect if you like</h2>
          <p>
            Play with the on-screen keyboard or an optional USB or Bluetooth
            MIDI piano.
          </p>
        </article>
      </section>
      <section className={styles.closing}>
        <div>
          <p className={styles.eyebrow}>Made for everyday practice</p>
          <h2>Your music stays yours.</h2>
        </div>
        <p>
          Included pieces work offline. Imported scores and practice settings
          stay on your device. Enable private iCloud sync in the Library to keep
          imported scores available across your Apple devices. No tracking or
          advertising.
        </p>
        <Link href="/pianoforte/privacy">
          How Pianoforte handles your data →
        </Link>
      </section>
    </main>
  );
}
