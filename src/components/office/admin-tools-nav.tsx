"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type AdminToolsLink = { href: string; label: string };

/**
 * Groups the office nav's low-frequency admin pages (Customers, Sites,
 * Projects, Import, Templates, Users) behind one "Admin Tools" trigger,
 * so the main nav bar stays short — these aren't day-to-day items the
 * way Jobs/SLA/Scheduler are. Plain click-toggle + outside-click/Escape
 * to close, matching the rest of this office UI's convention of native
 * elements over a component library (no dropdown/menu primitive is used
 * anywhere else in the app).
 */
export function AdminToolsNav({ links }: { links: AdminToolsLink[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 whitespace-nowrap"
      >
        Admin Tools
        <span aria-hidden="true" className="text-xs">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div role="menu" className="bg-popover absolute top-full left-0 z-50 mt-2 flex min-w-40 flex-col gap-0.5 rounded-md border p-1 shadow-md">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              // Deferred rather than closing synchronously in the same
              // click tick — unmounting this Link immediately (removing it
              // from the DOM as part of the very click that's supposed to
              // navigate it) raced the browser's own default navigation
              // and silently cancelled it, confirmed by testing this in a
              // real browser: the dropdown closed but the page never
              // changed. Letting the click's default action run first
              // fixes it without giving up plain <Link> semantics (hover
              // prefetch, ctrl/cmd-click opening a new tab, etc.).
              onClick={() => setTimeout(() => setOpen(false), 0)}
              className="hover:bg-accent hover:text-accent-foreground rounded-md px-2 py-1.5 text-sm"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
