import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

// /api is public at the proxy layer because it has no browser session to
// check anyway — its routes (ICS feed, cron triggers, DB webhooks) are
// called by calendar apps, external schedulers, and Postgres itself, and
// each authenticates itself its own way (HMAC token, shared secret header).
const PUBLIC_PATHS = ["/login", "/auth", "/share", "/api"];

// supabase-js's fetch has no built-in timeout, so an unreachable Auth
// service would otherwise hang this call — and every request through this
// middleware, including the public /login page — indefinitely. Bound it and
// fail closed (treat as logged-out) so an Auth outage degrades to "please
// log in" instead of a dead app.
const SESSION_CHECK_TIMEOUT_MS = 5000;

async function getUserWithTimeout(
  supabase: ReturnType<typeof createServerClient<Database>>,
) {
  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), SESSION_CHECK_TIMEOUT_MS);
  });
  return Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    timeout,
  ]);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Revalidates the session with the auth server (not just the local cookie)
  // on every request that isn't already public, per @supabase/ssr's guidance.
  const user = await getUserWithTimeout(supabase);

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
