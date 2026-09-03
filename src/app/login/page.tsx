"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { appBaseUrl } from "@/lib/app-url";

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
        emailRedirectTo: `${appBaseUrl()}/auth/callback`,
        // Magic link is superadmin-only in practice (enforced in getCurrentUser) —
        // this stops a brand-new email from self-provisioning an account via OTP.
        shouldCreateUser: false,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }

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
      setStatus("error");
      setError(oauthError.message);
    }
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

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <UxgLogo className="mb-2 h-9 w-auto" />
          <CardTitle>Engineer Job Scheduler</CardTitle>
          <CardDescription>Sign in with your UX Global Google account.</CardDescription>
        </CardHeader>
        <CardContent>
          {status !== "sent" ? (
            <div className="mb-6 flex flex-col gap-4">
              <Button type="button" variant="outline" onClick={handleGoogleSignIn}>
                Sign in with Google
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">Superadmin magic link</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          ) : null}
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
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
