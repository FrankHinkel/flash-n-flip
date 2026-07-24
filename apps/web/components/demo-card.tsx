"use client";

import { useState } from "react";

import { useI18n } from "./i18n-provider";

export function DemoCard() {
  const [revealed, setRevealed] = useState(false);
  const { text } = useI18n();
  return (
    <div className={`demo-card ${revealed ? "demo-revealed" : ""}`}>
      <span className="subject-pill">{text("BIOLOGY", "BIOLOGIE")}</span>
      <span className="card-step">12 / 24</span>
      <p>
        {revealed
          ? text(
              "They generate most of the cell's energy in the form of ATP.",
              "Sie erzeugen den Großteil der Energie in Form von ATP.",
            )
          : text(
              "What is the function of mitochondria?",
              "Welche Aufgabe haben die Mitochondrien?",
            )}
      </p>
      {!revealed && (
        <div className="cell-sketch" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
      )}
      <button type="button" onClick={() => setRevealed((value) => !value)}>
        {revealed
          ? text("Back to question", "Zurück zur Frage")
          : text("Show answer", "Antwort zeigen")}
      </button>
    </div>
  );
}
