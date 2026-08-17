# Multi-stage build for a self-hosted VM deploy (see DECISIONS.md's
# deploy addendum). Not used by the CI path — pnpm build there runs
# directly on the runner, no Docker involved.

FROM node:22-slim AS base
RUN corepack enable

# --- deps: install once, cached across builds as long as the lockfile doesn't change ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder: compile with the deps layer's node_modules ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at container startup — unlike every other env var this app uses
# (Supabase service role key, Resend, Monday.com, ...), which stay in
# .env.production and are only ever read at runtime. These four are the
# full set referenced anywhere under src/.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# V8 sizes its default heap ceiling off detected physical RAM, not swap —
# on a memory-constrained VM that default sits well under what's actually
# available once swap is added, and the build's TypeScript-checking pass
# (a separate worker process) hits it. Raise it explicitly so the build
# can actually use the swap instead of hitting a self-imposed ceiling.
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

# --- runner: just the standalone server output, no source or devDependencies ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
