"use client";

import Link from "next/link";
import { Repeat2 } from "lucide-react";

import { product } from "@flashcards/i18n";

import { useI18n } from "./i18n-provider";

export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { text } = useI18n();
  return (
    <Link
      className={["brand", className].filter(Boolean).join(" ")}
      href="/"
      aria-label={text("Flash & Flip home", "Flash & Flip Startseite")}
    >
      <span className="brand-mark" aria-hidden="true">
        <Repeat2 size={20} strokeWidth={2.4} />
      </span>
      {!compact && <span>{product.name}</span>}
    </Link>
  );
}
