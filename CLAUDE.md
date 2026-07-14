# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is **Supervisa 360**, a frontend-only SPA for 2 ADRA supervisors (Arequipa and Tacna)
to coordinate supervision visits to ~330 partner associations.

Supabase is fully configured: the initial migration
(`supabase/migrations/20260714055304_initial_schema.sql`) has the six tables, enums,
triggers (snapshot of the responsible advisor, one-active-visit enforcement, result
completeness), RLS policies, the `v_monthly_progress` view, and a `pg_cron` job; a
deterministic `supabase/seed.sql` provides two local test supervisors plus sample
advisors/associations/visits; `src/types/database.types.ts` is generated from that schema;
`src/services/supabase/client.ts` is the typed client; `src/lib/env.ts` validates env vars.
See [docs/development/local-supabase.md](docs/development/local-supabase.md).

The frontend MVP (`HU-06` through `HU-24`) is implemented end-to-end: auth with protected
routes, the responsive app shell/navigation, the initial dashboard, advisors (read-only),
associations (list/detail/edit + history), the shared agenda, visit scheduling with the
RN-12/RN-16/RN-17 duplicate/annual-repeat guards, reschedule/cancel, marking a visit
done/not-done with score+comment, editing a realized visit's result, and monthly goals.
`docs/backlog/status.md` tracks what's done vs. pending per `HU-XX`. When extending a
feature, follow the folder structure and conventions described below and check that doc
first for what still needs manual/external action (real accounts, real CSV import,
Vercel env vars).

The product/business context lives in `docs/` (all in Spanish) — read the relevant doc
before implementing a feature, since the domain rules are intricate:

- [docs/product/mvp.md](docs/product/mvp.md) — problem, goals, scope.
- [docs/product/business-rules.md](docs/product/business-rules.md) — numbered rules
  `RN-01`...`RN-27` (association/visit states, duplicate-visit prevention, scoring,
  goals). Referenced by ID elsewhere in the docs and should be referenced by ID in code
  comments/commits when relevant.
- [docs/product/out-of-scope.md](docs/product/out-of-scope.md) — explicitly excluded
  features and why (don't build these unless the user asks).
- [docs/product/user-flows.md](docs/product/user-flows.md) — UX flows.
- [docs/architecture/architecture.md](docs/architecture/architecture.md) — high-level
  architecture (see summary below).
- [docs/architecture/database-design.md](docs/architecture/database-design.md) —
  entities, relations, constraints, open questions.
- [docs/backlog/initial-backlog.md](docs/backlog/initial-backlog.md) — ordered user
  stories (`HU-01`...`HU-26`) with acceptance criteria and dependencies; useful for
  understanding what "done" looks like for a given feature.

## Commands

```sh
npm run dev            # start Vite dev server
npm run build           # tsc -b (project references) + vite build
npm run lint             # eslint .
npm run format           # prettier --write .
npm run format:check    # prettier --check .
npm run test              # vitest run (single run, not watch)
npx vitest                 # watch mode
npx vitest run path/to/file.test.tsx   # run a single test file
npx vitest run -t "test name"           # run tests matching a name

npm run supabase:start  # start local Supabase (needs Docker)
npm run supabase:stop
npm run db:reset          # rebuild local DB from migrations + seed.sql
npm run db:lint            # supabase db lint --local
npm run db:types           # regenerate src/types/database.types.ts (UTF-8 safe, see scripts/gen-types.mjs)
```

There is no separate typecheck script; `tsc -b` runs as part of `npm run build`.

## Architecture

Frontend-only SPA (React + TypeScript + Vite) talking directly to **Supabase** as the
backend — no custom server. Supabase provides Auth (email/password, 2 fixed accounts,
public signup disabled), PostgreSQL with RLS, and an auto-generated PostgREST API
consumed directly by the frontend. Both supervisors have identical permissions, so RLS
policies just require an authenticated user (no per-row ownership).

Critical business rules must be enforced in **both** the frontend (for UX) and the
database (as constraints, so they hold even under concurrent/incorrect API use) — most
notably `RN-12`: an association can have at most one active visit (`PROGRAMADA` or
`REPROGRAMADA`) at a time, enforced via a partial unique index on `Visit.association_id`.

### Code organization (feature-based, not file-type-based)

Source is organized by domain under `src/`:

- `src/app/` — app shell / composition root (routing, providers).
- `src/features/auth/` — login, session, protected routes.
- `src/features/associations/` — list, search, detail, status/advisor editing.
- `src/features/advisors/` — advisor catalog (read-only in MVP).
- `src/features/visits/` — schedule, reschedule, cancel, record results.
- `src/features/schedule/` — shared agenda view and its filters.
- `src/features/goals/` — individual/joint monthly goals panel.
- `src/shared/components/`, `src/shared/hooks/`, `src/shared/utils/`, `src/shared/types/`
  — cross-feature components (`LoadingState`, `ErrorState`, `EmptyState`, `ConfirmDialog`,
  `MonthNavigator`...), the `useAsyncData`/`useDebouncedValue` hooks, Zod schemas shared
  between forms (`shared/utils/schemas.ts`), Spanish labels (`shared/utils/labels.ts`),
  timezone-safe date helpers (`shared/utils/date.ts`), and domain types/enums re-exported
  from the generated `Database` type (`shared/types/domain.ts`).
- `src/services/supabase/` — the typed client (`client.ts`) plus one thin module per table
  (`associations.ts`, `visits.ts`, `goals.ts`, ...) wrapping PostgREST calls; no
  TanStack Query, just `async` functions consumed via `useAsyncData`. `errors.ts` is the
  central Postgres/PostgREST → Spanish error translator; never show a raw Postgres message
  to a supervisor.
- `src/lib/` — infrastructure-level code, e.g. `src/lib/env.ts` validates
  `import.meta.env` against a Zod schema (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  and throws a descriptive error at startup if env vars are missing/invalid.

The `@/*` path alias maps to `src/*` (configured in both `tsconfig.app.json` and
`vite.config.ts` — keep them in sync if it changes).

### Stack specifics

- **UI**: MUI (`@mui/material` + `@emotion/*`).
- **Routing**: `react-router-dom`.
- **Forms/validation**: `react-hook-form` + `@hookform/resolvers` + `zod`. Zod schemas
  double as the source of truth for both client-side "soft" validation (e.g. warnings)
  and shape validation; hard/critical constraints (e.g. `RN-12`, score range `RN-19`)
  must also be enforced at the database level, not just in Zod.
- **Backend client**: `@supabase/supabase-js`. Never use a Supabase service-role key in
  frontend code — only the public anon key, gated by RLS.
- **Testing**: Vitest + React Testing Library + jsdom, configured in `vite.config.ts`
  (`test` block) with setup file `src/test/setup.ts` (adds `jest-dom` matchers and
  calls RTL `cleanup()` after each test). `globals: false` — import `describe`/`it`/
  `expect` etc. from `vitest` explicitly rather than relying on test globals.
- **Env vars**: copy `.env.example` to `.env.local` (git-ignored) and fill in real
  Supabase project values; never commit real credentials.

### Linting/formatting

ESLint flat config (`eslint.config.js`) extends `js.configs.recommended`,
`tseslint.configs.recommended`, `reactHooks` flat recommended, `reactRefresh` (Vite
preset), and `eslint-config-prettier` (disables stylistic rules that conflict with
Prettier — don't add stylistic ESLint rules, use Prettier for formatting). Prettier
config (`.prettierrc.json`): single quotes, semicolons, 100-char print width, trailing
commas everywhere.

TypeScript is strict (`strict`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` all on) — see `tsconfig.app.json`.
