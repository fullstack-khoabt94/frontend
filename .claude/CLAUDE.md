# Taskflow — Frontend

Single-page todo application. **Frontend only** — the backend is built separately. Every
screen, form, validation rule and query hook is in place; the axios layer points at
`VITE_API_BASE_URL` and expects the contract in section 6.

---

## 1. Product requirements

The UI must support exactly this feature set:

**Tasks**

- Add a task
- Update a task
- Delete a task
- Mark a task as **in progress**
- Mark a task as **done**

**Lists** (all five are first-class, URL-addressable views)

- List all tasks
- List all tasks that are **done**
- List all tasks that are **not done** (composite of `todo` + `in_progress`)
- List all tasks that are **in progress**
- List all tasks that are **to do**

**Account**

- Login
- Logout
- Signup
- Forgot password
- Reset password

Anything not on this list is out of scope unless explicitly requested.

---

## 2. Domain model

### Task

| Field         | Type                                | Notes                  |
| ------------- | ----------------------------------- | ---------------------- |
| `id`          | `string`                            | Server-generated       |
| `title`       | `string`                            | Required, 1–120 chars  |
| `description` | `string \| null`                    | Optional, ≤ 1000 chars |
| `status`      | `'todo' \| 'in_progress' \| 'done'` | Defaults to `todo`     |
| `priority`    | `'low' \| 'medium' \| 'high'`       | Defaults to `medium`   |
| `dueDate`     | `string \| null`                    | ISO 8601; optional     |
| `createdAt`   | `string`                            | ISO 8601               |
| `updatedAt`   | `string`                            | ISO 8601               |

`priority` and `dueDate` are **supporting fields**, not requirements. They exist so the
list has something to sort and rank by. If the backend does not have them, drop them from
`taskSchema` / `taskFormSchema` and the UI degrades cleanly.

### Status is a three-state enum, not a boolean

`done` is a status, **not** a `completed: boolean`. "Not done" is derived
(`status !== 'done'`), never stored. Do not introduce a separate boolean flag — it creates
two sources of truth.

### Filters

`TaskFilter = 'all' | 'not_done' | 'todo' | 'in_progress' | 'done'`

`not_done` is resolved **server-side** so pagination and counts stay correct. The client
never merges two list responses.

### User

`{ id, name, email, avatarUrl?, createdAt }` — passwords never leave the auth endpoints.

### Session

`sessionStore` (`features/auth/session.ts`) holds `{ accessToken, user }` **in memory
only**.

**Nothing in this codebase writes to `localStorage`, `sessionStorage` or cookies.** That is
deliberate, not an oversight — do not add browser storage without being asked. A reload
signs the user out until persistence is designed alongside the real backend (httpOnly
cookie, refresh-token exchange, whatever the API decides). Hydrating `state` in that one
module is the only change the rest of the app needs.

The same rule covers the theme: `ThemeProvider` keeps the light/dark choice in memory and
defaults to `light`.

---

## 3. Routes and UX decisions

```
/                        → redirect: /tasks if signed in, else /login
/login                   ┐
/signup                  │ _auth  (pathless layout)
/forgot-password         │        signed-in visitors are bounced to /tasks
/reset-password?token=…  ┘
/tasks?filter&q&sort       _app   (pathless layout, requires a session)
```

**Why one task page, not one page per filter.** All five views are the same list with a
different predicate. Splitting them into routes would duplicate the toolbar, the empty
states and the mutation wiring, and would make switching filters feel like a page load.
Instead the filter lives in the URL as a search param, so every view is still linkable,
refresh-safe and back-button friendly.

**Search params are the source of truth** for `filter`, `q` and `sort` on `/tasks`. They
are validated by `taskSearchSchema` (zod) with `.catch()` fallbacks, so a hand-edited or
stale URL degrades to defaults instead of crashing.

**Guards live in `beforeLoad`**, not in components — a protected page never renders a frame
before redirecting. `/_app` records the attempted URL in `?redirect=` so login returns the
user where they were going.

**Auth screens share one frame** (`AuthShell`): brand panel on the left (hidden below
`lg`), form on the right. Four screens, one layout, no drift.

**Forgot-password never confirms whether an email exists.** The success copy is
deliberately conditional ("If an account exists for…"). Do not "improve" this into a "no
account found" error — that is an account-enumeration leak.

**Destructive actions confirm.** Delete goes through an `AlertDialog` naming the task.

**Status changes are optimistic.** Toggling a task is the most frequent action in the app,
so `useUpdateTaskStatus` writes to the cache immediately and rolls back on error. Create /
update / delete are _not_ optimistic — they are rarer and the server response carries
fields the client cannot invent.

---

## 4. Tech stack

| Concern      | Choice                                                 |
| ------------ | ------------------------------------------------------ |
| Build        | Vite 8 + React 19 + TypeScript 6                       |
| Routing      | TanStack Router (file-based, auto code-splitting)      |
| Server state | TanStack Query 5                                       |
| Forms        | React Hook Form + `@hookform/resolvers/zod`            |
| Validation   | Zod 4                                                  |
| HTTP         | Axios                                                  |
| UI           | shadcn/ui (`radix-nova` style, Radix) + Tailwind CSS 4 |
| Icons        | lucide-react                                           |
| Toasts       | sonner                                                 |
| Theming      | Local `ThemeProvider` — no theming library             |
| Quality      | ESLint + Prettier + husky + lint-staged + commitlint   |

**Zod is the single schema source.** Form validation, API response parsing and search
params all derive from the same schemas in `features/*/schemas.ts`. Never hand-write a
TypeScript type that duplicates a schema — use `z.infer` / `z.input` / `z.output`.

---

## 5. Project structure

```
src/
├── components/
│   ├── ui/                 shadcn primitives — regenerated by the CLI, avoid hand-edits
│   ├── layout/             app-header
│   ├── common/             logo
│   ├── theme-provider.tsx
│   └── mode-toggle.tsx
├── features/
│   ├── auth/
│   │   ├── components/     auth-shell, password-input, password-strength
│   │   ├── api.ts          axios calls, responses parsed with zod
│   │   ├── queries.ts      TanStack Query mutations
│   │   ├── schemas.ts      zod schemas + inferred types
│   │   └── session.ts      in-memory store: token + user
│   └── tasks/
│       ├── components/     task-item, dialogs, filter bar, summary, empty states
│       ├── api.ts
│       ├── queries.ts      query options, mutations, cache keys
│       ├── schemas.ts
│       └── constants.ts    labels, icons and colour classes per status/priority/filter
├── hooks/                  use-debounced-value, use-theme
├── lib/
│   ├── api/client.ts       axios instance + interceptors
│   ├── env.ts              every VITE_* flag, read in exactly one place
│   ├── format.ts           date/initials helpers
│   ├── query-client.ts
│   ├── theme-context.ts
│   └── utils.ts            cn()
├── routes/                 file-based routes; routeTree.gen.ts is GENERATED
├── router.tsx
└── main.tsx
```

**Feature-first, not type-first.** A feature owns its schemas, API calls, queries and
components. Only genuinely shared things go in `components/` or `lib/`.

`src/routeTree.gen.ts` is generated by `@tanstack/router-plugin` on dev/build. Never edit
it, never resolve merge conflicts in it — regenerate instead.

`testing/` holds throwaway screenshots from manual QA and is gitignored.

---

## 6. Backend contract

There is no mock and no fixture data — the app talks to whatever `VITE_API_BASE_URL` points
at. Until that exists the screens render, every request fails, and the error is surfaced
inline rather than crashing.

| Method   | Path                    | Request                                             | Response                                                  |
| -------- | ----------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `POST`   | `/auth/signup`          | `{ name, email, password }`                         | `201 { accessToken, user }`                               |
| `POST`   | `/auth/login`           | `{ email, password, rememberMe }`                   | `200 { accessToken, user }` · `401` on bad credentials    |
| `POST`   | `/auth/logout`          | —                                                   | `204`                                                     |
| `GET`    | `/auth/me`              | —                                                   | `200 user`                                                |
| `POST`   | `/auth/forgot-password` | `{ email }`                                         | `200 { message }` — always 200, even for unknown emails   |
| `POST`   | `/auth/reset-password`  | `{ token, password }`                               | `200 { message }` · `400` on expired token                |
| `GET`    | `/tasks`                | query: `filter`, `q?`, `sort`                       | `200 { data: Task[], stats: Record<TaskFilter, number> }` |
| `POST`   | `/tasks`                | `{ title, description, status, priority, dueDate }` | `201 Task`                                                |
| `PATCH`  | `/tasks/:id`            | same as POST                                        | `200 Task`                                                |
| `PATCH`  | `/tasks/:id/status`     | `{ status }`                                        | `200 Task`                                                |
| `DELETE` | `/tasks/:id`            | —                                                   | `200 Task` (or `204`)                                     |

`stats` must be computed **after** the `q` search filter but **before** the status filter —
the counts on the filter tabs describe "how many would I see if I switched to that tab".

Errors should return `{ "message": "human readable" }`; `getApiErrorMessage()` surfaces that
string directly in toasts and inline alerts.

Auth is `Authorization: Bearer <accessToken>`, attached by a request interceptor. A `401` on
any non-auth endpoint clears the session and redirects to `/login`.

**If the backend uses httpOnly refresh cookies instead**, change `sessionStore` and the
interceptors in `lib/api/client.ts` — no component needs to know.

---

## 7. Design system

### Palette (fixed — provided by design, do not substitute)

| Token       | Hex       | Role                                                        |
| ----------- | --------- | ----------------------------------------------------------- |
| `brand-50`  | `#E3F2FD` | Soft surfaces, hover tints, secondary/accent fills          |
| `brand-200` | `#90CAF9` | Borders, tracks, the primary action colour in **dark** mode |
| `brand-500` | `#2196F3` | Interactive accent, focus rings, the **in progress** status |
| `brand-900` | `#0D47A1` | Primary buttons, brand mark, auth side panel                |

`brand-100 / 300 / 600 / 700` are interpolations of the four above, used only for hover and
active states. Colours are declared in `src/index.css` as OKLCH.

Semantic status colours live alongside the brand ramp: `--status-todo` (neutral grey),
`--status-progress` (= `brand-500`), `--status-done` (green — the one intentional non-brand
hue, because "completed" reading as green is a stronger UX signal than palette purity).

**Dark mode inverts the action colour**: `--primary` is `brand-900` on light and `brand-200`
on dark, so contrast stays above 4.5:1 in both. The app opens in **light** mode; the header
toggle switches it for the session.

### Rules

- Use semantic tokens (`bg-primary`, `text-muted-foreground`, `border-border`) in
  components. Reach for `brand-*` only for deliberate brand moments.
- Never hardcode a hex value in a component.
- Every colour must be defined for light **and** dark. Test both.
- Status colour, icon and label always come from `STATUS_META` — never inline them.

---

## 8. Responsive behaviour

Tailwind's default breakpoints. The layout is mobile-first and verified from **320px**
upward; there is no horizontal page scroll at any width.

| Breakpoint    | What changes                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `< sm` (640)  | Auth pages drop the brand panel and show the small logo. Task rows hide the inline Start / Finish / Reopen buttons — the checkbox and the ⋯ menu carry those actions. Status filters render as a `<Select>`. Header hides the user's name, keeps the avatar. |
| `≥ sm` (640)  | Inline quick-action buttons on task rows. Status filters become the segmented tab strip (~500px wide, so it fits from 640 without scrolling). Task dialog widens to `max-w-lg`.                                                                              |
| `≥ md` (768)  | Summary cards go from 2×2 to a single row of 4.                                                                                                                                                                                                              |
| `≥ lg` (1024) | Auth pages become the two-column split: brand panel left, form right.                                                                                                                                                                                        |

Rules that keep it working:

- **The task dialog is height-constrained**: `max-h-[calc(100dvh-2rem)]` with the header and
  footer pinned and only the field group scrolling. Without this the Create / Cancel buttons
  become unreachable on a short viewport (small phones, any phone in landscape) because the
  dialog is `position: fixed` and the page scroll cannot reach it. Any new dialog with more
  than a few fields needs the same treatment.
- **User-generated text uses `wrap-anywhere`** on task titles and descriptions, so a long
  unbroken string cannot widen the row.
- **Content max-width is `max-w-5xl`** on both the header and the page body so they stay
  aligned on wide screens.
- When adding a filter or a summary card, re-check the tab strip still fits at 640 — it is
  the tightest constraint in the layout.

---

## 9. Conventions

- **Imports** use the `@/` alias, never `../../..`.
- **Files** are kebab-case; components are PascalCase; hooks are `use-*`.
- **Query keys** come from `taskKeys` — never write an inline array key.
- **Mutations own their toasts.** Components call `mutate` and stay quiet.
- **Loading states are skeletons**, not spinners, wherever the shape is known.
- **Empty states are specific**: no-search-results, no-tasks-at-all and each per-filter
  empty state have their own copy (`task-empty-state.tsx`).
- **Accessibility is not optional**: every icon-only button has an `aria-label`, form errors
  are wired via `aria-invalid` + `FieldError`, filter tabs use real `role="tablist"`
  semantics.
- **shadcn components** in `src/components/ui/` are vendored. Add new ones with
  `npx shadcn@latest add <name>` rather than hand-writing them.
- **`form` component does not exist** in the `radix-nova` style — use `Field`, `FieldLabel`,
  `FieldError` and `FieldGroup` with React Hook Form's `register` / `Controller`.
- Prefer `Controller` / `useWatch` over `form.watch()`.
- **No browser storage.** See section 2.

---

## 10. Tooling and git hooks

**Package manager is npm** — `package-lock.json` is committed and the hooks call `npm run`.
If the team moves to yarn, swap the lockfile and update the three files in `.husky/`
together; mixing the two silently breaks the hooks for everyone else.

| Hook         | Runs                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged` (eslint --fix + prettier --write on staged files), then `npm run typecheck` |
| `commit-msg` | `commitlint` — Conventional Commits                                                       |
| `pre-push`   | `npm run lint`, `npm run typecheck`, `npm run format:check`                               |

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org):
`type(scope): subject`, where type is one of `feat`, `fix`, `docs`, `style`, `refactor`,
`perf`, `test`, `build`, `ci`, `chore`, `revert`. Scopes are optional and kebab-case; the
header is capped at 100 characters.

ESLint is flat-config (`eslint.config.js`) with typescript-eslint, react-hooks and
react-refresh; `eslint-config-prettier` turns off everything Prettier owns so the two never
fight. `src/routeTree.gen.ts` and `testing/` are excluded from both.

---

## 11. Commands

```bash
npm run dev           # Vite dev server on :5173
npm run build         # tsc -b && vite build
npm run preview       # serve the production build
npm run lint          # eslint .
npm run lint:fix      # eslint . --fix
npm run typecheck     # tsc -b --noEmit
npm run format        # prettier --write .
npm run format:check  # prettier --check .
npm run verify        # lint + typecheck + format:check (same gate as pre-push)
```

---

## 12. Known gaps (intentional)

- No backend. Every screen renders, every request 404s until `VITE_API_BASE_URL` points at
  a real API.
- No pagination — the list endpoint returns everything. Add cursor params to
  `taskSearchSchema` and `tasksApi.list` when the backend supports it.
- No session persistence — `accessToken` lives in memory, so a reload returns the user to
  `/login`. See section 2; this is left for the backend integration.
- No refresh-token rotation. If the backend issues refresh tokens, add a response
  interceptor that retries once on 401.
- No account/profile page — the header menu only offers logout.
- No tests — the wiring is deliberately thin so it can be tested once the API is real.
