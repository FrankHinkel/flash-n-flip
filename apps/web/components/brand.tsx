"use client";

import Link from "next/link";
import { product } from "@flashcards/i18n";

import { useI18n } from "./i18n-provider";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={["brand-mark", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <img alt="" height="37" src="/brand/flash-and-flip.svg" width="37" />
    </span>
  );
}

export function Brand({
  className,
  compact = false,
  href = "/",
}: {
  className?: string;
  compact?: boolean;
  href?: string;
}) {
  const { text } = useI18n();
  return (
    <Link
      className={["brand", className].filter(Boolean).join(" ")}
      href={href}
      aria-label={text("Flash-n-Flip home", "Flash-n-Flip Startseite")}
    >
      <BrandMark />
      {!compact && <span>{product.name}</span>}
    </Link>
  );
}
