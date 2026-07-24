import Link from "next/link";
import { Sprout } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Flora Startseite">
      <span className="brand-mark" aria-hidden="true">
        <Sprout size={20} strokeWidth={2.4} />
      </span>
      {!compact && <span>flora</span>}
    </Link>
  );
}
