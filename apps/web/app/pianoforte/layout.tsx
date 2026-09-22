import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./pianoforte.module.css";

export default function PianoforteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <Link
          className={styles.brand}
          href="/pianoforte"
          aria-label="Pianoforte home"
        >
          <span className={styles.brandIcon} aria-hidden="true" />
          <span>Pianoforte</span>
        </Link>
        <nav className={styles.navigation} aria-label="Pianoforte">
          <Link href="/pianoforte">Overview</Link>
          <Link href="/pianoforte/privacy">Privacy</Link>
          <Link href="/pianoforte/support">Support</Link>
          <a className={styles.flashLink} href="/">
            Flash-n-Flip ↗
          </a>
        </nav>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>Pianoforte · Frank Hinkel © 2026</span>
        <nav aria-label="Footer">
          <Link href="/pianoforte/privacy">Privacy</Link>
          <Link href="/pianoforte/support">Support</Link>
          <a href="/">Discover Flash-n-Flip ↗</a>
        </nav>
      </footer>
    </div>
  );
}
