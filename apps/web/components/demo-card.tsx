"use client";

import { useState } from "react";

import { useI18n } from "./i18n-provider";

export function DemoCard() {
  const [revealed, setRevealed] = useState(false);
  const { text } = useI18n();
  return (
    <div className={`demo-card ${revealed ? "demo-revealed" : ""}`}>
      <span className="subject-pill">{text("legacy.fed8c298d68d")}</span>
      <span className="card-step">12 / 24</span>
      <p>
        {revealed ? text("legacy.2397d0523de5") : text("legacy.f0f48324e725")}
      </p>
      {!revealed && (
        <div className="cell-sketch" aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
      )}
      <button type="button" onClick={() => setRevealed((value) => !value)}>
        {revealed ? text("legacy.9bffb739b2be") : text("legacy.955f77c8a724")}
      </button>
    </div>
  );
}
