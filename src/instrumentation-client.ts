import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-config";

const options = sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN);
if (options) Sentry.init(options);
