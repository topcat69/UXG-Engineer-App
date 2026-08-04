import type { captureRequestError } from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-config";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const options = sentryOptions(process.env.SENTRY_DSN);
  if (!options) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init(options);
}

export async function onRequestError(...args: Parameters<typeof captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
