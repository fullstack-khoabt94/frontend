# Taskflow — Frontend

A todo application UI built with React, Vite and shadcn/ui. Add, update, delete and track
tasks across **to do / in progress / done**, with a full authentication flow (login,
signup, logout, forgot password, reset password).

The backend lives in a separate service. This repo ships the UI and the typed API layer
that expects it.

> **Working on this repo?** Read [`.claude/CLAUDE.md`](.claude/CLAUDE.md) first — it
> documents the business rules, the domain model, the endpoint contract the UI expects and
> the conventions this codebase follows.

## Stack

Vite 8 · React 19 · TypeScript · TanStack Router · TanStack Query · React Hook Form · Zod ·
Axios · Tailwind CSS 4 · shadcn/ui

## Getting started

```bash
npm install
cp .env.example .env.local   # point VITE_API_BASE_URL at your API
npm run dev
```

Open http://localhost:5173. Until the backend is reachable every screen still renders, but
requests fail and the error is shown inline — sign up or sign in once the API is running.

## Scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server on port 5173             |
| `npm run build`     | Type-check and build for production |
| `npm run preview`   | Serve the production build          |
| `npm run lint`      | ESLint                              |
| `npm run typecheck` | TypeScript, no emit                 |
| `npm run format`    | Prettier, write                     |
| `npm run verify`    | lint + typecheck + format:check     |

## Quality gates

Git hooks are installed by husky on `npm install`:

- **pre-commit** — `lint-staged` (ESLint `--fix` + Prettier on staged files) then a full
  type-check
- **commit-msg** — commitlint, [Conventional Commits](https://www.conventionalcommits.org)
- **pre-push** — lint, type-check and format check across the project

## Screens

| Route                     | Purpose                                                             |
| ------------------------- | ------------------------------------------------------------------- |
| `/login`                  | Email + password sign-in, with a link to password recovery          |
| `/signup`                 | Account creation with a live password-strength meter                |
| `/forgot-password`        | Request a reset link (never reveals whether an email exists)        |
| `/reset-password?token=…` | Set a new password from an emailed token                            |
| `/tasks`                  | The app: summary, search, sort, five status filters, full task CRUD |

Filter, search and sort all live in the URL, so any view can be bookmarked or shared.
