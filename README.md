# UXG Engineer Job Scheduler

Field service & job management platform. See `PROMPT.md` for the full spec
and build phases, and `DECISIONS.md` for the architectural choices made along
the way.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Database (Supabase, local)

```bash
pnpm db:start     # requires Docker
pnpm db:reset     # applies supabase/migrations
pnpm db:types      # regenerates src/lib/supabase/database.types.ts
```
