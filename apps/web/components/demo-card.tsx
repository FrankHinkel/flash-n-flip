"use client";

import { useState } from "react";

export function DemoCard() {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={`demo-card ${revealed ? "demo-revealed" : ""}`}>
      <span className="subject-pill">BIOLOGIE</span>
      <span className="card-step">12 / 24</span>
      <p>
        {revealed
          ? "Sie erzeugen den Großteil der Energie in Form von ATP."
          : "Welche Aufgabe haben die Mitochondrien?"}
      </p>
      {!revealed && (
        <div className="cell-sketch" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
      )}
      <button type="button" onClick={() => setRevealed((value) => !value)}>
        {revealed ? "Zurück zur Frage" : "Antwort zeigen"}
      </button>
    </div>
  );
}
