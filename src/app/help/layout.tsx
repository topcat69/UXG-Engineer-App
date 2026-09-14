import Link from "next/link";
import { homeRouteForRole, requireAnyUser } from "@/lib/auth/current-user";
import { signOut } from "@/lib/auth/actions";
import { roleLabel } from "@/lib/format/text";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";

/**
 * Reachable from every role's own header — see requireAnyUser's doc
 * comment. This layout has no "home" of its own, so its back link goes
 * to whichever surface this role actually lives on.
 */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAnyUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <UxgLogo className="h-6 w-auto" />
          <Link href={homeRouteForRole(user.role)} className="text-muted-foreground text-sm underline-offset-2 hover:underline">
            ← Back to the app
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {user.name} · {roleLabel(user.role)}
          </span>
          <ThemeSwitcher currentTheme={user.theme} />
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground hover:text-foreground underline">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">{children}</main>
    </div>
  );
}
