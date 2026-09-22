import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import styles from "./pianoforte.module.css";

export const metadata: Metadata = {
  title: { absolute: "Pianoforte — piano practice with real sheet music" },
  description:
    "A free piano-practice companion for iPhone and iPad with sheet music, falling notes, automatic accompaniment, score following and flexible MIDI routing.",
  alternates: { canonical: "/pianoforte" },
};

export default function PianofortePage() {
  return (
    <main id="main" className={styles.main}>
      <section className={styles.hero} aria-labelledby="pianoforte-title">
        <div>
          <p className={styles.eyebrow}>A better way to practise piano</p>
          <h1 id="pianoforte-title">
            Music first.
            <br />
            Practice at your pace.
          </h1>
          <p className={styles.lead}>
            Pianoforte brings a readable score, falling notes and your piano
            together. Practise one hand with accompaniment, let the app find
            your place in the music, or slow down and loop a tricky passage —
            without an account or subscription.
          </p>
          <p className={styles.availability}>
            Free app for iPhone and iPad · App Store release in preparation
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryLink} href="/pianoforte/support">
              Contact &amp; support
            </Link>
          </div>
        </div>
      </section>
      <figure className={styles.preview}>
        <Image
          src="/pianoforte/practice-preview.png"
          width={1782}
          height={1553}
          sizes="(max-width: 760px) calc(100vw - 32px), 1120px"
          alt="Pianoforte practice view showing Für Elise as sheet music and falling notes above a piano keyboard"
          priority
        />
      </figure>
      <section className={styles.features} aria-label="What Pianoforte offers">
        <article>
          <span aria-hidden="true">01</span>
          <h2>See the music</h2>
          <p>Read the score, switch to falling notes, or keep both in view.</p>
        </article>
        <article>
          <span aria-hidden="true">02</span>
          <h2>Play together</h2>
          <p>Practise one hand while Pianoforte automatically plays the other.</p>
        </article>
        <article>
          <span aria-hidden="true">03</span>
          <h2>Find your place</h2>
          <p>
            Turn on Follow your play and start playing. Pianoforte looks for
            your position in the open score and follows along.
          </p>
        </article>
        <article>
          <span aria-hidden="true">04</span>
          <h2>Make MIDI your own</h2>
          <p>
            Use multiple MIDI inputs and outputs at once, with independent
            routing for each connected device.
          </p>
        </article>
        <article>
          <span aria-hidden="true">05</span>
          <h2>Give silent keys a voice</h2>
          <p>
            Hear a MIDI keyboard without speakers through Pianoforte&apos;s
            built-in piano sound on your device.
          </p>
        </article>
        <article>
          <span aria-hidden="true">06</span>
          <h2>Stay with a passage</h2>
          <p>
            Slow the tempo, set an A/B loop, transpose or focus on one hand.
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
