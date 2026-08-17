"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { UxgLogo } from "@/components/branding/uxg-logo";

type Status = "idle" | "sending" | "sent" | "error";
type CodeStatus = "idle" | "verifying" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [codeError, setCodeError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }

  /**
   * Fallback for the link-click flow: some corporate email security
   * gateways pre-fetch every link in an incoming message to scan it before
   * delivery, which silently burns a single-use magic link before the real
   * user ever clicks it. Typing in the code sidesteps that entirely — there's
   * no link for a scanner to consume. Requires the Magic Link email template
   * (Supabase dashboard > Authentication > Emails) to include {{ .Token }}.
   */
  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeStatus("verifying");
    setCodeError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (verifyError) {
      setCodeStatus("error");
      setCodeError(verifyError.message);
      return;
    }

    window.location.href = "/";
  }

  /**
   * Same callback route and same post-auth gate as magic-link (see
   * getCurrentUser in src/lib/auth/current-user.ts) — anyone with a Google
   * account can complete this OAuth flow, but they're then immediately
   * redirected to /login unless a matching, active row already exists in
   * the users table. This only starts working once Google is turned on as
   * a provider in the Supabase dashboard (Authentication > Providers >
   * Google) with a Google Cloud OAuth client id/secret — that's
   * console/dashboard configuration this code can't do on its own.
   */
  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signInError) setError(signInError.message);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <UxgLogo className="mb-2 h-9 w-auto" />
          <CardTitle>Engineer Job Scheduler</CardTitle>
          <CardDescription>Sign in with a magic link — no password needed.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Check {email} for a sign-in link, or enter the code from that email below.
              </p>
              <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Enter the code from your email"
                  />
                </div>
                {codeError ? <p className="text-sm text-destructive">{codeError}</p> : null}
                <Button type="submit" disabled={codeStatus === "verifying"}>
                  {codeStatus === "verifying" ? "Verifying…" : "Verify code"}
                </Button>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send magic link"}
              </Button>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="bg-border h-px flex-1" />
                or
                <span className="bg-border h-px flex-1" />
              </div>
              <Button type="button" variant="outline" onClick={handleGoogleSignIn}>
                Sign in with Google
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
