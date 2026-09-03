"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { UxgLogo } from "@/components/branding/uxg-logo";
import { appBaseUrl } from "@/lib/app-url";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);

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
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
