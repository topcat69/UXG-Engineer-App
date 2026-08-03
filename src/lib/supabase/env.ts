// Next.js only inlines `process.env.NEXT_PUBLIC_X` into the browser bundle
// when it's a static member-access expression — a dynamic
// `process.env[name]` helper is NOT replaced and silently evaluates to
// `undefined` client-side. The two public accessors below must each spell
// out the literal property access; only the server-only one may stay generic.

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return value;
}

export function supabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  return value;
}
