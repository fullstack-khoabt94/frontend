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

Mirrors the backend `TaskResponse` exactly.

| Field         | Type                                | Notes                                       |
| ------------- | ----------------------------------- | ------------------------------------------- |
| `id`          | `string`                            | Server-generated UUID                       |
| `title`       | `string`                            | Required, 1–120 chars                       |
| `description` | `string \| null`                    | **Required on write** (`@NotBlank`), ≤ 1000 |
| `status`      | `'TODO' \| 'IN_PROGRESS' \| 'DONE'` | Defaults to `TODO`                          |
| `priority`    | `'LOW' \| 'MEDIUM' \| 'HIGH'`       | Defaults to `MEDIUM`                        |
| `dueDate`     | `string \| null`                    | Local date-time, no zone; must be future    |
| `userId`      | `string`                            | Owner                                       |

**Enum casing is SCREAMING_SNAKE_CASE** because Jackson serialises the Java enums by
`name()`. Do not lowercase them on the wire — deserialisation fails in both directions.

**There is no `createdAt` / `updatedAt`.** The columns exist in the database and on
`BaseEntity`, but `TaskResponse` does not expose them, so the list cannot be ordered by
age. That is why the sort options are priority / due date / title.

**`dueDate` is a Java `LocalDateTime`**, so the wire format is `"2026-08-30T00:00:00"` —
no `Z`, no offset. Sending an `Instant`-style UTC string fails to parse
(`ISO_LOCAL_DATE_TIME` rejects the trailing `Z`). `tasksApi` converts the date input's
`yyyy-MM-dd` accordingly.

The backend validates `dueDate` with `@Future`, and midnight today is already past, so
only tomorrow onwards is accepted. The form enforces the same rule client-side.

### Status is a three-state enum, not a boolean

`DONE` is a status, **not** a `completed: boolean`. "Not done" is derived
(`status !== 'DONE'`), never stored. Do not introduce a separate boolean flag — it creates
two sources of truth.

### Filters

`TaskFilter = 'all' | 'not_done' | 'todo' | 'in_progress' | 'done'`

These are **client-side, UI-only concepts** and stay lowercase so URLs read well — they
are never sent to the backend. `GET /task/all` takes no parameters, so filtering,
searching, sorting and the tab counts are all derived in the browser by
`features/tasks/list.ts`.

If the backend later grows `?filter=&q=&sort=` plus a stats envelope, delete that module
and forward the search params from `tasksApi.list` instead.

### User

`{ id, name, email, avatarUrl?, createdAt }` — passwords never leave the auth endpoints.

### Session

`sessionStore` (`features/auth/session.ts`) holds `{ accessToken, refreshToken, expiresAt,
user }` in memory and is the only module that touches browser storage.

**"Keep me signed in" is what decides persistence.** `sessionStore.set(session, remember)`
mirrors the session into a `taskflow_session` cookie when the login form's `rememberMe` is
ticked, and deletes that cookie when it is not — so signing in without the tick can never
inherit a cookie an earlier session left behind. `sessionStore.hydrate()` runs in
`main.tsx` **before the router mounts**, because the `beforeLoad` guards read the session
synchronously; hydrating later would bounce a remembered visitor to `/login` and back.

**Expiry is measured on one clock — the browser's — and is never read off the JWTs.** Both
tokens carry an `exp` claim, and decoding it here would need no backend field at all, but
`exp` is on the **server's** clock: comparing it against `Date.now()` mixes two clocks, so a
device set an hour fast reads a live session as expired and signs its owner out, invisibly
to everyone whose clock is right.

The two tokens are described differently because the backend stores them differently. The
access token's life comes as `accessTokenExpiresIn`, a duration in seconds. The refresh
token's comes as `refreshTokenExpiresIn` — which, despite the name, is a **timestamp**, and
a zone-less one: it is a Java `LocalDateTime`, serialised as `"2026-08-29T03:15:30"` with no
`Z` and no offset. `sessionFromAuthResponse()` reconciles the two into a single `expiresAt`
in local epoch milliseconds, and everything downstream compares against that one clock.

**The refresh deadline's true instant is unknowable on the client, and that is accepted
rather than worked around.** `Date.parse` reads a zone-less string as browser-local time:
exact when the server shares the visitor's timezone, off by the difference otherwise (a UTC
server and a UTC+7 browser land 7 hours apart even with perfect clocks). The reason this is
tolerable is that **the deadline is only ever an optimisation** — the server is the authority
on whether a token still works, and a stale one produces a 401, a refresh attempt and a clean
sign-out. So the two failure modes are bounded and asymmetric by design:

- Read too generously → the cookie outlives the tokens → one wasted round trip at boot before
  landing on `/login`. Harmless.
- Read too strictly → a shorter remembered session, but never shorter than the access token's
  own lifetime, because `sessionFromAuthResponse` takes `Math.max` of the two. With a UTC
  server and a UTC+7 browser, "24h" becomes 17h; nobody is signed out while their tokens are
  live.

That `Math.max` is load-bearing, and not only as a guard: the longer-lived token genuinely
decides how long the session lasts, and that is usually the refresh token (24h vs 1h) but not
always — a refresh mints a new access token **without** extending the refresh token, so late
in a long session the access token is the one still standing.

Two more consequences worth stating outright: `hydrate()` does **not** discard a session whose
access token has expired (that is precisely what the refresh token is for), and the cookie's
`Max-Age` is a duration the browser counts down itself, so it expires correctly even on a
machine whose clock is wrong.

### Refreshing

`refreshAccessToken()` (`features/auth/refresh.ts`) posts the refresh token to
`POST /auth/refresh-token` and installs the returned pair via `sessionStore.applyRefresh()`.
Three things about it are load-bearing:

- **It is single-flight.** A page fires several requests at once, so one expired access
  token produces a burst of 401s. Without the shared in-flight promise each would start its
  own exchange — and if the backend ever rotates refresh tokens, all but the first would be
  racing against an already-consumed one.
- **It uses bare `axios`, not the `api` instance.** The interceptor that calls it lives on
  `api`; routing the exchange back through `api` recurses the moment the refresh itself
  answers 401.
- **`applyRefresh` does not take a `remember` flag.** Whether this visitor wanted to be kept
  signed in was decided at login, and a refresh must not silently change it — so it rewrites
  the cookie only if one already exists.

The response interceptor in `lib/api/client.ts` drives it: a `401` on a non-public path
triggers one refresh and one replay of the original request, guarded by
`config.retriedAfterRefresh` so a second 401 (now carrying a seconds-old token) cannot loop.
Only when the refresh is _rejected_ does the session end.

**A restored token is provisional until the backend confirms it.** Decoding `exp` locally
only proves the token has not expired; the signing secret may have rotated, the account may
be gone, the cookie may have been hand-edited. So `hydrate()` flags the session unverified
and `ensureSessionVerified()` (`features/auth/verify-session.ts`) calls `GET /user/me` from
the **root** route's `beforeLoad` — ahead of the guards on `/`, `/_auth` and `/_app`, so no
protected page renders on a token the API would reject. It runs at most once per page load
and returns `undefined` (not a resolved promise) once there is nothing to check.

**The response interceptor is the single place that decides what a `401` means.** Nothing
else may re-derive that verdict from a status code — `verify-session.ts` in particular
catches its failure and draws no conclusion at all. The reason is a real case that reading
the status gets wrong: when a request 401s and the _refresh_ then fails on the network, the
error that surfaces to the caller is still that original `401`, even though the interceptor
deliberately kept the session alive. A second opinion at that layer would sign the visitor
out for a wifi blip.

That is the general rule too — **"server answered" and "server unreachable" are not the same
outcome**, and must not collapse into one `catch`. A response that is not a usable token
ends the session; no response at all says nothing about the token, so the session survives
and the next attempt retries. `refresh.ts` draws the line at "did a response arrive at all"
rather than at a status code: the backend answers every bad refresh token with `401` —
unknown, revoked and expired alike — so there is no status worth branching on, and any reply
that is not a new token leaves no path back to a usable access token.

**This cookie is JS-readable, not httpOnly**, so it is exposed to XSS the same way the
in-memory token already is — and it now carries the 24h refresh token as well as the 1h
access token, which raises the stakes. The safe shape is the backend setting an httpOnly
cookie itself; until it does, `session.ts` is the only module that changes.

`localStorage` and `sessionStorage` are still unused — do not add them. The theme is also
still memory-only: `ThemeProvider` keeps the light/dark choice for the session and defaults
to `light`.

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
│   │   ├── components/     auth-shell, password-input
│   │   ├── api.ts          axios calls, responses parsed with zod
│   │   ├── queries.ts      TanStack Query mutations
│   │   ├── schemas.ts      zod schemas + inferred types
│   │   ├── refresh.ts      single-flight access-token exchange
│   │   ├── session.ts      tokens + user store, cookie-backed when "remember me"
│   │   └── verify-session.ts  boot-time check of a restored token
│   └── tasks/
│       ├── components/     task-item, dialogs, filter bar, summary, empty states
│       ├── api.ts
│       ├── list.ts         client-side filter / search / sort / stats
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

The frontend is written against the Spring Boot service in `backend/backend`, reached
through `VITE_API_BASE_URL` (`/api`, proxied to `localhost:8080` by the Vite dev server —
see `vite.config.ts`). `WebConfig` prefixes every controller path with `/api`.

### Tasks — implemented, and the frontend matches it

| Method   | Path         | Request                                                     | Response          |
| -------- | ------------ | ----------------------------------------------------------- | ----------------- |
| `GET`    | `/task/all`  | —                                                           | `200 Task[]`      |
| `GET`    | `/task/{id}` | —                                                           | `200 Task`        |
| `POST`   | `/task`      | `{ title, description, status, priority, dueDate, userId }` | `201 Task`        |
| `PUT`    | `/task/{id}` | same, without `userId`                                      | `200 Task`        |
| `DELETE` | `/task/{id}` | —                                                           | `201` + `"Done!"` |

Notes that shape the client:

- **Path is `/task`, singular**, and the collection is `/task/all`.
- **Update is `PUT`, not `PATCH`**, and `UpdateTaskDto` requires every field — partial
  updates are not possible.
- **There is no status-only endpoint.** Toggling a task sends a full `PUT` rebuilt from
  the task already in the cache (`useUpdateTaskStatus`).
- **`userId` is sent on create only**, read from `sessionStore`. When the backend takes
  the owner from the authenticated principal, drop it from `tasksApi.create`.
- `DELETE` answers `201` with a plain-text body; the client ignores both.

### Auth — signup and login are live

| Method | Path                    | Request                     | Response                                                   |
| ------ | ----------------------- | --------------------------- | ---------------------------------------------------------- |
| `POST` | `/auth/signup`          | `{ name, email, password }` | `201 user` — **no token**, the visitor still has to log in |
| `POST` | `/auth/login`           | `{ email, password }`       | `200 LoginResponse`                                        |
| `POST` | `/auth/refresh-token`   | `{ refreshToken }`          | `200 LoginResponse`                                        |
| `POST` | `/auth/forgot-password` | `{ email }`                 | not implemented yet                                        |
| `POST` | `/auth/reset-password`  | `{ token, password }`       | not implemented yet                                        |
| `GET`  | `/user/me`              | —                           | `200 user` — the authenticated principal                   |

`LoginResponse` is the same envelope from login and from refresh, which is why
`authResponseSchema` parses both:

```
{ user, accessToken, refreshToken, accessTokenExpiresIn, refreshTokenExpiresIn }
```

`accessTokenExpiresIn` is a duration in seconds. **`refreshTokenExpiresIn` is not** — despite
the name it is a `LocalDateTime` timestamp, zone-less (`"2026-08-29T03:15:30"`), which is why
the schema needs `z.iso.datetime({ local: true })` rather than the default. Section 2 covers
what the client does about the missing zone and why it is safe to live with.

**Refreshing returns the same refresh token, unchanged and un-extended** — there is no
rotation, so its deadline keeps counting down across refreshes and eventually ends the
session no matter how often the access token is renewed.

Notes that shape the client:

- **`LoginDto` is `{ email, password }` only.** "Keep me signed in" is a client-side idea;
  `authApi.login` does not send it — it only decides whether `sessionStore` writes its
  cookie. See section 2.
- **Both tokens are JJWT HS256 strings** whose `sub` is the user's UUID. The access token is
  signed with `app.jwt.secret` for `app.jwt.expiration-ms` (1h); the refresh token with
  `app.refresh-token.secret` for `app.refresh-token.expiration-ms` (24h) and is also stored
  in the `refresh_tokens` table, so the backend can revoke it.
- **Refresh does not rotate.** `/auth/refresh-token` echoes the same refresh token back with
  a new access token, and does not revoke the old one. `refresh.ts` re-saves whatever it is
  given, so rotation on the backend needs no client change.
- **There is no `/auth/logout`.** `useLogout()` is a plain callback that drops the session
  and clears the query cache. Note the consequence: the refresh token row stays valid
  server-side after signing out — `RefreshTokenServices#revokeRefreshToken` exists but no
  endpoint calls it.
- **The identity endpoint is `GET /user/me`, not `/auth/me`** — `UserController` reads the
  UUID off the `@AuthenticationPrincipal`. `authApi.me()` is the client for it, and it is
  the only way to ask the backend whether a token is still good, which is exactly what the
  boot-time session check uses it for (section 2). The user object still comes from the
  login response on a fresh sign-in; `/user/me` refreshes it on a restored one.
- `UserResponse` also carries `updatedAt`; `userSchema` ignores it.

### Errors

`GlobalExceptionHandler` returns `{ "message": "..." }`, which `getApiErrorMessage()`
surfaces in toasts and inline alerts. Validation failures and unhandled exceptions are not
mapped yet, so those still come back in Spring's default shape.

Auth is `Authorization: Bearer <accessToken>`, attached by a request interceptor. A `401`
on any non-auth endpoint clears the session and redirects to `/login` — `SecurityConfig`'s
entry point answers those with `{ "message": "Unauthorized" }`.

A caller that treats a `401` as a normal answer opts out with
`api.get(url, { skipAuthRedirect: true })` and handles it itself. The session check is the
only user today: the interceptor's redirect is a `window.location` assignment, which during
boot would cost a second full page load on top of the one already in flight.

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
- **The only browser storage is the session cookie**, written from `features/auth/session.ts`
  through `lib/cookies.ts`. No `localStorage`, no `sessionStorage`. See section 2.

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

- **Forgot / reset password have no backend.** Both screens call routes that do not exist.
- **Overdue tasks cannot be edited or toggled.** The backend validates `dueDate` with
  `@Future` on update as well as create, so any `PUT` carrying a past deadline is
  rejected — including a plain status toggle. Removing `@Future` from `UpdateTaskDto` (or
  dropping it entirely) is the fix; the client cannot work around it.
- **No sort by age.** `TaskResponse` omits `createdAt` / `updatedAt`.
- **No pagination.** `GET /task/all` returns every task and the browser does the rest.
  Fine for small lists; revisit when the backend paginates.
- **Tasks are not scoped to a user.** `getTasks()` has no `WHERE user_id = ?`, so once
  real accounts exist everyone will see everyone's tasks.
- **The refresh deadline crosses the wire without a timezone.** `LoginResponse` types it as
  `LocalDateTime`, so a browser in a different zone from the server reads it hours off. This
  is a **deliberate call, not an oversight**: the client absorbs it (section 2), the effect is
  a shorter remembered session rather than a wrong sign-out, and nothing is broken by it. If
  the app is ever deployed with a UTC server and users elsewhere, switching the field to
  `Instant` (`expiredAt.atZone(ZoneId.systemDefault()).toInstant()`) makes the deadline exact;
  the client needs only its zod schema relaxed back to a plain `z.iso.datetime()`.
- **Session persistence is client-side only.** "Keep me signed in" survives a reload via a
  JS-readable cookie, not an httpOnly one, because the backend does not set a cookie of its
  own. Without the tick, a reload still returns the user to `/login`. See section 2.
- **Refresh tokens are never rotated or revoked on use**, so one leaked refresh token is
  good for its full 24h no matter how many times it is spent. The client is already shaped
  for rotation (`applyRefresh` stores whatever comes back); the change is backend-side.
- **`app.refresh-token` reads the access token's env vars.** Both `secret` and
  `expiration-ms` default to `${JWT_SECRET:…}` / `${JWT_EXPIRATION_MS:…}` in
  `application.yml`, so setting either variable silently gives the refresh token the access
  token's secret and 1h lifetime — collapsing the two-token design back into one.
- No account/profile page — the header menu only offers logout.
- No tests — the wiring is deliberately thin so it can be tested once the API is real.
