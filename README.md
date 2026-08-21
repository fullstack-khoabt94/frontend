# Taskflow — Frontend

A todo application UI built with React, Vite and shadcn/ui. Add, update, delete and
track tasks across **to do / in progress / done**, with a full authentication flow
(login, signup, logout, forgot password, reset password).

The backend is separate. Until it exists, the app runs against an in-browser mock API
so every screen is fully explorable.

> **Working on this repo?** Read [`.claude/CLAUDE.md`](.claude/CLAUDE.md) first — it
> documents the business rules, the domain model, the endpoint contract the UI expects
> and the conventions this codebase follows.

## Stack

Vite 8 · React 19 · TypeScript · TanStack Router · TanStack Query · React Hook Form ·
Zod · Axios · Tailwind CSS 4 · shadcn/ui

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173 and sign in with the demo account:

```
demo@todo.app / Password123
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run oxlint |

## Connecting a real backend

```bash
# .env.local
VITE_API_BASE_URL=https://your-api.example.com/v1
VITE_USE_MOCK_API=false
```

Then delete `src/lib/api/mock-adapter.ts` and `src/lib/api/mock-db.ts`. The full list of
endpoints the UI calls — with request and response shapes — is in
[`.claude/CLAUDE.md`](.claude/CLAUDE.md#6-wiring-the-real-backend).

## Screens

| Route | Purpose |
| --- | --- |
| `/login` | Email + password sign-in, with a link to password recovery |
| `/signup` | Account creation with a live password-strength meter |
| `/forgot-password` | Request a reset link (never reveals whether an email exists) |
| `/reset-password?token=…` | Set a new password from an emailed token |
| `/tasks` | The app: summary, search, sort, five status filters, full task CRUD |

Filter, search and sort all live in the URL, so any view can be bookmarked or shared.
