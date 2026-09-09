import { requireWarehouseUser } from "@/lib/auth/current-user";
import { signOut } from "@/lib/auth/actions";
import { humanize } from "@/lib/format/text";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * A focused, kiosk-style surface for a shared warehouse-floor device —
 * deliberately not the full Office UI (see the Goods-In & Job Sheets
 * proposal's "Who does what" callout). Just goods-in for now; a
 * configuration screen joins it in a later phase.
 */
export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const user = await requireWarehouseUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <UxgLogo className="h-6 w-auto" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {user.name} · {humanize(user.role)}
          </span>
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
