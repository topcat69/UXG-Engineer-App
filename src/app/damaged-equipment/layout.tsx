import Link from "next/link";
import { homeRouteForRole, requireDamagedEquipmentUser } from "@/lib/auth/current-user";
import { signOut } from "@/lib/auth/actions";
import { roleLabel } from "@/lib/format/text";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * Its own top-level route, not under /office, since two of its four
 * allowed roles — Warehouse and Finance — have no access to /office at
 * all (see requireDamagedEquipmentUser). Same "own layout, reachable from
 * every allowed role's own surface" shape as /help.
 */
export default async function DamagedEquipmentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireDamagedEquipmentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href={homeRouteForRole(user.role)}>
          <UxgLogo className="h-6 w-auto" />
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href={homeRouteForRole(user.role)} className="text-muted-foreground hover:text-foreground underline">
            ← Back to the app
          </Link>
          <span className="text-muted-foreground">
            {user.name} · {roleLabel(user.role)}
          </span>
          <Link href="/help" className="text-muted-foreground hover:text-foreground underline">
            Help
          </Link>
          <ThemeSwitcher currentTheme={user.theme} />
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
