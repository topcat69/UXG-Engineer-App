"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { appBaseUrl } from "@/lib/app-url";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appBaseUrl()}/auth/callback`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  /** For an account with no Google Workspace seat (a 3rd-party contractor, or a shared kiosk login) — set up from /office/users. */
  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSigningIn(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setIsSigningIn(false);
      setError(signInError.message);
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <UxgLogo className="mb-2 h-9 w-auto" />
          <CardTitle>Engineer Job Scheduler</CardTitle>
          <CardDescription>Sign in with your UX Global Google account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button type="button" variant="outline" onClick={handleGoogleSignIn}>
              Sign in with Google
            </Button>

            {showPasswordForm ? (
              <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-3 border-t pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" disabled={isSigningIn}>
                  {isSigningIn ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="text-muted-foreground text-sm underline-offset-2 hover:underline"
              >
                No Google account? Sign in with a password
              </button>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
