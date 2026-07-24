"use client";

import {
  BookOpen,
  Compass,
  Library,
  LogOut,
  Settings,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { api } from "../lib/api";

const items = [
  { href: "/app", label: "Übersicht", icon: Sprout },
  { href: "/app/decks", label: "Meine Lernsets", icon: Library },
  { href: "/app/learn", label: "Lernen", icon: BookOpen },
  { href: "/community", label: "Entdecken", icon: Compass },
  { href: "/app/settings", label: "Einstellungen", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <Link className="brand" href="/app">
          <span className="brand-mark">
            <Sprout size={20} />
          </span>
          <span>flora</span>
        </Link>
        <nav aria-label="App-Navigation">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={
                pathname === href ||
                (href !== "/app" && pathname.startsWith(`${href}/`))
                  ? "active"
                  : ""
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button
          className="sidebar-logout"
          onClick={async () => {
            await api.logout();
            router.push("/");
          }}
        >
          <LogOut size={19} /> Abmelden
        </button>
      </aside>
      <div className="app-content">{children}</div>
      <nav className="mobile-nav" aria-label="Mobile App-Navigation">
        {items.slice(0, 4).map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={pathname === href ? "active" : ""}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
