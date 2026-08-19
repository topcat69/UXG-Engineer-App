import Link from "next/link";
import { requireOfficeUser } from "@/lib/auth/current-user";
import { signOut } from "@/lib/auth/actions";
import { humanize } from "@/lib/format/text";
import { UxgLogo } from "@/components/branding/uxg-logo";

const NAV = [
  { href: "/office/dashboard", label: "Dashboard" },
  { href: "/office/jobs", label: "Jobs" },
  { href: "/office/scheduler", label: "Scheduler" },
  { href: "/office/qa", label: "QA Queue" },
  { href: "/office/reports", label: "Reports" },
  { href: "/office/clients", label: "Clients" },
  { href: "/office/projects", label: "Projects" },
  { href: "/office/import", label: "Import" },
  { href: "/office/templates", label: "Templates" },
  { href: "/office/users", label: "Users" },
];

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOfficeUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <UxgLogo className="h-6 w-auto" />
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {user.name} · {humanize(user.role)}
          </span>
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground hover:text-foreground underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
