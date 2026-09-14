import Link from "next/link";
import { requireFinanceUser } from "@/lib/auth/current-user";
import { signOut } from "@/lib/auth/actions";
import { roleLabel } from "@/lib/format/text";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * A focused surface for the Finance role — Asset Register only, same
 * "own route instead of the shared /office layout" pattern as
 * /kiosk for Warehouse (see the Goods-In & Job Sheets proposal's "Who
 * does what" callout, and requireFinanceUser's doc comment).
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireFinanceUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <UxgLogo className="h-6 w-auto" />
        <div className="flex items-center gap-3 text-sm">
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
