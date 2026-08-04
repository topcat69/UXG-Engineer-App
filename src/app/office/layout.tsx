import Link from "next/link";
import { requireOfficeUser } from "@/lib/auth/current-user";

const NAV = [
  { href: "/office/dashboard", label: "Dashboard" },
  { href: "/office/jobs", label: "Jobs" },
  { href: "/office/scheduler", label: "Scheduler" },
  { href: "/office/qa", label: "QA Queue" },
  { href: "/office/import", label: "Import" },
];

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOfficeUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">OPOC</span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <span className="text-muted-foreground text-sm">
          {user.name} · {user.role}
        </span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
