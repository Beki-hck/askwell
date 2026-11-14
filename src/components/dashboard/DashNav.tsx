"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/follow-ups", label: "Follow-ups", badge: "followUps" as const },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/quality", label: "Answer quality" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashNav(counts: { unanswered: number; followUps: number }) {
  const path = usePathname();
  return (
    <nav className="dash-nav" aria-label="Owner area">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} aria-current={path === link.href ? "page" : undefined}>
          {link.label}
          {link.badge && counts[link.badge] > 0 && (
            <span aria-label={`${counts[link.badge]} open`}>{counts[link.badge]}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
