# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is **Supervisa 360**, a frontend-only SPA for 2 ADRA supervisors (Arequipa and Tacna)
to coordinate supervision visits to ~330 partner associations. The project is at the
initial scaffolding stage (`HU-01` in the backlog): tooling is configured but no feature
code exists yet — `src/features/*` and `src/shared/*` are empty placeholder directories
(`.gitkeep` only), `src/App.tsx` is still the default Vite template, and there is no
Supabase client, router, or MUI theme wired up yet. When implementing features, follow the
folder structure and conventions described below rather than the current placeholder state.

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
- `src/shared/components/`, `src/shared/utils/` — cross-feature components, types, and
  utilities (e.g. Zod schemas shared between forms).
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
