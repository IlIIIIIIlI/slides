"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home", exact: true },
  { href: "/workspace", label: "Workspace" },
  { href: "/library", label: "Library" },
];

function NavLink({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "text-sm px-3 py-1.5 rounded-md transition-colors",
        active
          ? "text-foreground bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      {label}
    </Link>
  );
}

export function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-screen-xl mx-auto px-4 flex items-center justify-between h-full gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-teal-500/15 flex items-center justify-center">
            <Layers className="w-4 h-4 text-teal-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight">K2S Studio</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
        </nav>

        <Button size="sm" asChild className="shrink-0">
          <Link href="/workspace">New Deck</Link>
        </Button>
      </div>
    </header>
  );
}
