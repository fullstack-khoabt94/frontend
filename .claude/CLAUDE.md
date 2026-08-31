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

**Boards** (tasks are grouped into boards)

- Create a board
- Update a board
- **Archive** / restore a board
- Delete a board
- Open a board and manage its tasks

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
| `boardId`     | `string \| null`                    | Board it belongs to — see below             |
| `createdAt`   | `string`                            | Local date-time; the default sort           |
| `updatedAt`   | `string`                            | Local date-time                             |

**There is no `userId`.** `TaskResponse` dropped it when ownership moved to the board; a task
reaches its owner through `task.board.user`. Nothing on the client needed it.

**Enum casing is SCREAMING_SNAKE_CASE** because Jackson serialises the Java enums by
`name()`. Do not lowercase them on the wire — deserialisation fails in both directions.

**`createdAt` / `updatedAt` are on the DTO now**, which is what makes ordering by age
possible — `createdAt` is the backend's own `@PageableDefault` sort and the client's default
too. Sorting by title or by priority is _not_ possible; section 6 says why.

**`dueDate` is a Java `LocalDateTime`**, so the wire format is `"2026-08-30T00:00:00"` —
no `Z`, no offset. Sending an `Instant`-style UTC string fails to parse
(`ISO_LOCAL_DATE_TIME` rejects the trailing `Z`). `tasksApi` converts the date input's
`yyyy-MM-dd` accordingly.

The backend validates `dueDate` with `@Future`, and midnight today is already past, so
only tomorrow onwards is accepted. The form enforces the same rule client-side.

### Board

Mirrors `BoardResponse` exactly.

| Field         | Type             | Notes                                          |
| ------------- | ---------------- | ---------------------------------------------- |
| `id`          | `string`         | Server-generated UUID                          |
| `title`       | `string`         | Required, 1–50 chars (the column, not the DTO) |
| `description` | `string \| null` | **Required on write** (`@NotBlank`)            |
| `color`       | `string`         | One of six accent names, see below             |
| `icon`        | `string \| null` | An emoji                                       |
| `isArchived`  | `boolean`        | Set by `DELETE`; nothing sets it back          |
| `userId`      | `string`         | Owner                                          |

**`color` and `icon` are presentation, and the client owns their vocabulary.**
The backend stores plain strings; `BOARD_COLORS` (`blue`, `emerald`, `amber`, `rose`,
`violet`, `slate`) and `BOARD_ICONS` live in `features/boards/schemas.ts`. Both parse with
`.catch()` rather than strictly, so a value this build does not recognise degrades to the
default instead of failing the whole list parse and blanking the grid.

The backend defaults both columns to the literal string `'default'`, which is exactly the
case that guard absorbs — though `icon` then renders the word rather than an emoji, so the
default is worth changing server-side.

**`description` is required on write**, because both board DTOs mark it `@NotBlank`. The
form asks for it up front rather than sending `null` into a 400.

**The archived flag is read from `isArchived` or `archived`.** As built, `BoardResponse` is a
**record** with a `Boolean` component, so Jackson uses the component name and emits
`isArchived` — the first key hits and nothing more is needed. The fallback stays because the
trap it guards is real for any non-record DTO: a `boolean isArchived` field with an
`isArchived()` getter serialises as `archived`, since the bean introspector strips the `is`
prefix the way it strips `get`. (A wrapper `Boolean` is never treated as an is-getter either,
so the combination here is doubly safe.)

### Archiving is the only way to remove a board

`DELETE /board/{id}` is a **soft delete**: `BoardServiceImpl.deleteBoard` sets `isArchived`
and leaves the row and every task under it in place. There is no hard-delete endpoint, and
nothing sets the flag back — so the UI offers **archive only: no delete, no restore.**

Three consequences, all deliberate rather than omissions:

- `useArchiveBoard` calls `DELETE` and optimistically flips `isArchived` in the cache, so the
  card leaves the Active grid at once instead of sitting in a view it no longer belongs to.
- An archived board's action menu keeps **only Edit**, and the detail header drops its
  archive button rather than offering a toggle with no second state.
- `ArchiveBoardDialog` says outright that the board keeps its tasks and cannot be restored
  from the app. Both facts are surprising enough that discovering them later would be worse.

### Tasks belong to boards, and a board is now the only way to reach them

`Task.boardId` is **required on create** (`taskFormSchema`) and still **nullable on read**,
which now costs nothing at all: `V5__create_boards_table.sql` made `tasks.board_id NOT NULL`,
so a board-less task cannot exist. The `.catch(null)` and the "No board" chip stay as cheap
guards, not as a case anyone will hit.

That column is why the cross-board screen is gone. `GET /task/all` takes `boardId` as a
**required** parameter, so no single request returns tasks from more than one board — and the
one reason `/tasks` was kept (somewhere for board-less tasks to appear) can no longer happen.

`TaskFormDialog` still takes both props, and inside a board only the first is used:

- `lockedBoardId` fills it from the route and the picker is not rendered — the board is
  context, not a choice.
- `boards` renders a `<Select>`. Nothing passes it today; it is what a cross-board create
  would use if that screen ever returns.

**The picker is create-only.** `UpdateTaskDto` has no `boardId`, so on an existing task the
select is `disabled` — shown, so the row still says which board the task is in, but not
editable, and `tasksApi.update` does not send the field at all. Sending it would be dropped
silently and would read like a working feature.

An archived board stays selectable only if the task is already in it, so the picker can
never silently drop the value it was handed.

### Status is a three-state enum, not a boolean

`DONE` is a status, **not** a `completed: boolean`. "Not done" is derived
(`status !== 'DONE'`), never stored. Do not introduce a separate boolean flag — it creates
two sources of truth.

### Filters

`TaskFilter = 'all' | 'not_done' | 'todo' | 'in_progress' | 'done'`

These are **client-side, UI-only concepts** and stay lowercase so URLs read well — they
are never sent to the backend. `GET /task/all` accepts `boardId`, `page`, `size` and `sort`,
and nothing else: no `?status=`, no `?q=`.

**So the filter and the search box narrow one page of results, not the whole board**, and the
tab counts describe that same page. On a board of 60 tasks at 20 per page, "Done" shows the
done tasks among the 20 currently loaded. That is a real limitation and the UI states it
rather than hiding it: `TaskSummary` prints a page-scoped caption whenever there is more than
one page, and `TaskPagination` reports the server's `total` underneath the list — the only
figure on the screen that spans the whole board.

Sorting is **not** in this bucket. It moved to the server with the pagination, because a
client-side sort would reorder one page against the ordering the paging is walking through.

Delete `features/tasks/list.ts` the moment the backend accepts `?status=` and `?q=`; every
count on the screen becomes honest in the same commit.

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
/                            → redirect: /boards if signed in, else /login
/login                       ┐
/signup                      │ _auth  (pathless layout)
/forgot-password             │        signed-in visitors are bounced to /boards
/reset-password?token=…      ┘
/boards?view&q                           ┐
/boards/$boardId?filter&q&sort&page&size │ _app (pathless layout, requires a session)
/tasks → redirect: /boards               ┘
```

**Boards are the entry point.** `/`, login and the `_auth` guard all land on `/boards`,
because a task lives inside a board and the grid is where you pick one.

**`/tasks` is a redirect now, not a screen.** `GET /task/all` requires a `boardId`, so no
request returns tasks from more than one board, and a cross-board page could only be
assembled from one call per board — which is exactly the "load everything" the pagination
exists to stop. The route file stays so old links land on `/boards` instead of a 404, and it
carries the note on what to restore if a cross-board endpoint ever appears.

**`/boards/$boardId` is the task list.** It owns `TaskFilterBar`, `TaskSummary`, `TaskItem`,
`TaskPagination` and both dialogs under `taskSearchSchema`. There is only one task screen, so
there is nothing to keep in sync — but the components stay presentational and take everything
by prop, because a second one is a plausible future.

**Every change to what is being listed resets `page` to 1.** Filter, sort, page size and the
debounced search all go through one `changeSearch` helper for that reason: keeping page 4
while switching filters lands the visitor on an empty page of a shorter result. The route
also clamps a `?page=` that is past the end — deleting the last row of the last page would
otherwise read "Showing 41–40 of 40".

**The board detail page is keyed on `boardId`.** `BoardDetailRoute` renders
`<BoardDetailPage key={boardId} …>` so moving between boards remounts it and re-seeds the
search box from that board's URL. Doing that in an effect instead sets state during render
and cascades an extra pass — `react-hooks/set-state-in-effect` will reject it.

**Why one task page, not one page per filter.** All five views are the same list with a
different predicate. Splitting them into routes would duplicate the toolbar, the empty
states and the mutation wiring, and would make switching filters feel like a page load.
Instead the filter lives in the URL as a search param, so every view is still linkable,
refresh-safe and back-button friendly.

**Search params are the source of truth** for `filter`, `q`, `sort`, `page` and `size` on
`/boards/$boardId`. They are validated by `taskSearchSchema` (zod) with `.catch()` fallbacks,
so a hand-edited or stale URL degrades to defaults instead of crashing — `?size=9999` becomes
20 rather than a 400 from Spring, and `?page=0` becomes 1.

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
│   ├── boards/
│   │   ├── components/     board-card, board-form-dialog, archive-board-dialog,
│   │   │                   board-empty-state
│   │   ├── api.ts
│   │   ├── list.ts         client-side search / archive split
│   │   ├── queries.ts
│   │   ├── schemas.ts
│   │   └── constants.ts    colour and view metadata
│   └── tasks/
│       ├── components/     task-item, dialogs, filter bar, summary, pagination,
│       │                   empty states
│       ├── api.ts          request params in, PagedResponse out
│       ├── list.ts         page-scoped filter / search / stats
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

### Boards — implemented; the client matches it as built

| Method   | Path          | Request                               | Response      |
| -------- | ------------- | ------------------------------------- | ------------- |
| `GET`    | `/board/all`  | —                                     | `200 Board[]` |
| `GET`    | `/board/{id}` | —                                     | `200 Board`   |
| `POST`   | `/board`      | `{ title, description, color, icon }` | `201 Board`   |
| `PUT`    | `/board/{id}` | same                                  | `200 Board`   |
| `DELETE` | `/board/{id}` | —                                     | `200 "Done"`  |

The four decisions that shaped the client, all of them the backend's:

- **The label field is `title`, not `name`.** `boardSchema` follows it rather than renaming
  at the boundary — a hidden translation is invisible the next time the two are compared.
- **No `userId` in the body.** `BoardController` reads the owner off the
  `@AuthenticationPrincipal`, so `boardsApi.create` sends nothing and never touches
  `sessionStore`. `tasksApi.create` does the same; the old "userId on create" note is gone.
- **`DELETE` is a soft delete.** `BoardServiceImpl.deleteBoard` flips `isArchived` and leaves
  the row and every task under it alone, so `boardsApi.archive` is the _archive_ action and
  there is no hard delete anywhere in the UI.
- **`UpdateBoardDto` has no `isArchived`, and nothing else sets it back to false.** So there
  is **no restore**. The board card, the detail header and the empty-state copy all had the
  restore path removed rather than left to fail silently, and `ArchiveBoardDialog` says
  outright that archiving cannot be undone from the app.

Two limits the form enforces on the backend's behalf:

- **Title caps at 50.** `Board.title` is `varchar(50)` while the DTO validates `@Size(max =
120)`, so 51–120 characters clear validation and then 500 on the insert. The form holds the
  tighter of the two.
- **Description is required.** Both board DTOs mark it `@NotBlank`.

`GET /board/all` returns archived boards too, which is what the client wants — the
active/archived split is a client-side view, like the task filters.

**`BoardResponse` carries no task counts, and they can no longer be derived.** The grid used
to compute "3 of 8 done" per board from one cross-board `GET /task/all`. That call is now
board-scoped and paginated, so rebuilding the counts would take either a request per board
on the landing page or a request per board big enough to hold every task. The card dropped
its progress bar instead of showing a number that is quietly wrong — `buildProgressByBoard`
and `BoardProgress` are gone with it. Adding `taskCount` and `doneCount` to `BoardResponse`
(two `COUNT(*)`s on a table already filtered by board) brings the bar straight back.

### Every task list is board-scoped

`/board/{id}/task` does not exist, but `GET /task/all` now takes **`boardId` as a required
parameter**, which serves the same purpose. So the scoping moved out of the browser and into
the request, and `buildListView(tasks, search, boardId)` became `buildPageView(page, search)`.

That also reversed the cache key. `taskKeys.list(params)` is keyed by `(boardId, page, size,
sort)` — a single shared array could not survive a paginated endpoint, since two pages of one
board are genuinely different responses. `taskKeys.lists()` is the prefix the mutations
invalidate and the optimistic toggle writes through.

`TaskResponse` **dropped `userId`** — ownership moved to the board, and a task reaches its
owner through `task.board.user`. Nothing on the client needed it, so nothing replaced it. It
**gained `createdAt` and `updatedAt`**, which is what made ordering by age possible.

**`UpdateTaskDto` has no `boardId`** and `updateTask` never touches `task.board`, so a task
cannot change board. `tasksApi.update` deliberately does not send the field, and the picker in
`TaskFormDialog` is `disabled` when editing — shown, so the row still says which board the
task is in, but not editable.

### Tasks — paginated, and the frontend matches it

| Method   | Path                               | Request                                                      | Response                  |
| -------- | ---------------------------------- | ------------------------------------------------------------ | ------------------------- |
| `GET`    | `/task/all?boardId&page&size&sort` | —                                                            | `200 PagedResponse<Task>` |
| `GET`    | `/task/{id}`                       | —                                                            | `200 Task`                |
| `POST`   | `/task`                            | `{ boardId, title, description, status, priority, dueDate }` | `201 Task`                |
| `PUT`    | `/task/{id}`                       | same, without `boardId`                                      | `200 Task`                |
| `DELETE` | `/task/{id}`                       | —                                                            | `200` + `"Done"`          |

`PagedResponse<T>` is `{ data: T[], page, size, total, totalPages }` — Spring's `Page`
flattened by `com.eazybytes.dtos.PagedResponse`. Notes that shape the client:

- **`boardId` is required**, so there is no cross-board list. See above.
- **`page` is zero-based on the wire**, because it is `Page#getNumber()`. The URL and every
  component work in one-based pages; `tasksApi.list` is the only place that converts, in
  both directions.
- **`sort` is Spring's `property,direction`**, and only three properties are accepted:
  `TaskServiceImpl.ALLOWED_SORT` is `{createdAt, dueDate, priority}`. `Sorts.sanitize`
  **silently drops** anything else and falls back to `id DESC`, so an unsupported option
  would not error — it would quietly return the wrong order. That is why `TASK_SORTS` lost
  two entries:
  - **`title_asc`** — `title` is not in `ALLOWED_SORT`.
  - **`priority_desc`** — it _is_ in `ALLOWED_SORT`, but `Task.priority` is
    `@Enumerated(STRING)`, so the database orders it alphabetically (`HIGH, LOW, MEDIUM`),
    not by urgency. Offering it would be offering a wrong answer.
  - Sorting by `dueDate` descending opens with every undated task, because Postgres puts
    NULLs first descending and neither the query nor `Sorts` sets a `NULLS` clause.
- **`size` is capped by Spring at 2000**, not by the controller. The client offers 10 / 20 /
  50 and validates the search param against that list.
- **Default page size is 20**, matching `@PageableDefault(size = 20)`, and the default sort
  is `createdAt,desc` on both sides.
- **Path is `/task`, singular**, and the collection is `/task/all`.
- **Update is `PUT`, not `PATCH`**, and `UpdateTaskDto` requires every field — partial
  updates are not possible.
- **There is no status-only endpoint.** Toggling a task sends a full `PUT` rebuilt from
  the task already in the cache (`useUpdateTaskStatus`), which writes optimistically across
  every cached page rather than one key.
- **`boardId` is sent on create only**, from the form. `CreateTaskDto` marks it `@NotNull`;
  `UpdateTaskDto` has no such field.
- `DELETE` answers `200` with a plain-text body; the client ignores both.

### Auth — signup and login are live

| Method | Path                                 | Request                         | Response                                                   |
| ------ | ------------------------------------ | ------------------------------- | ---------------------------------------------------------- |
| `POST` | `/auth/signup`                       | `{ name, email, password }`     | `201 user` — **no token**, the visitor still has to log in |
| `POST` | `/auth/login`                        | `{ email, password }`           | `200 LoginResponse`                                        |
| `POST` | `/auth/refresh-token`                | `{ refreshToken }`              | `200 LoginResponse`                                        |
| `POST` | `/auth/request-reset-password-token` | `{ email }`                     | `200` + `"Token issued!"` (`text/plain`)                   |
| `PUT`  | `/auth/reset-password`               | `{ resetpwToken, newPassword }` | `200` + `"Success!"` (`text/plain`)                        |
| `GET`  | `/user/me`                           | —                               | `200 user` — the authenticated principal                   |

The two password-reset rows are the ones most likely to trip you up, because none
of them match the names the screens use:

- **The request endpoint is `/auth/request-reset-password-token`**, not
  `/auth/forgot-password` — `AuthController` names it after the row it writes.
  (`SecurityRoutes` still lists a `/api/auth/forgot-password` that no handler
  serves; it is dead config, not a second endpoint.)
- **Reset is `PUT`**, not `POST`.
- **Its fields are `{ resetpwToken, newPassword }`**, not `{ token, password }`.
  Jackson maps the unknown names to nulls, so the wrong shape fails `@NotBlank`
  with a `400` that never mentions the real cause. `authApi.resetPassword` does
  the renaming so the form keeps the names it validates.
- **Both answer `text/plain`, not JSON.** `authApi` returns `Promise<void>` for
  the pair — there is no `{ message }` envelope to read.
- **Both raise `401` on the unhappy path** (unknown email, spent or unknown
  token), which is why both are on `PUBLIC_PATHS` in `lib/api/client.ts`.

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

### Board accents — the one deliberate departure from the brand ramp

`--board-blue / emerald / amber / rose / violet / slate`, each with a `-soft` companion, in
`src/index.css`. A board's colour is a **label the user picks to tell their boards apart at
a glance**, so six of them have to be distinguishable _from each other_ — which a single
blue ramp cannot do. `blue` is `brand-500`, so the default board still reads as Taskflow.

The rules that keep this from becoming a free-for-all:

- Components never name a `--board-*` token and never a hex. Everything resolves through
  `BOARD_COLOR_META` in `features/boards/constants.ts`, exactly as `STATUS_META` works for
  statuses.
- Both shades are redefined under `.dark` — the solid lightened so it still passes as text
  on a dark card, the soft fill darkened from a near-white tint. Reusing the light values
  would put a white tile on every dark board card.
- The colour picker marks its selection with a **tick, not colour alone**, and the tick is
  `text-background` so it inverts with the swatch.
- Do not add a seventh colour without checking both themes.

The board card no longer has a progress bar — `BoardResponse` carries no counts and the task
endpoint is board-scoped, so there is nothing left to derive one from. If it comes back, note
why it was hand-rolled rather than using the shadcn `<Progress>`: that primitive paints its
indicator `bg-primary`, and these bars carry the board's own accent. `BOARD_COLOR_META` still
exposes `bar` for it.

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

| Breakpoint    | What changes                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `< sm` (640)  | Auth pages drop the brand panel and show the small logo. Task rows hide the inline Start / Finish / Reopen buttons — the checkbox and the ⋯ menu carry those actions. Status filters render as a `<Select>`. Pagination drops the numbered pages for a `3 / 8` counter between the arrows. Header hides the user's name, keeps the avatar. |
| `≥ sm` (640)  | Inline quick-action buttons on task rows. Status filters become the segmented tab strip (~500px wide, so it fits from 640 without scrolling). Task dialog widens to `max-w-lg`. Board grid goes 1 → 2 columns, and board detail's Edit button shows its label.                                                                             |
| `≥ md` (768)  | Summary cards go from 2×2 to a single row of 4.                                                                                                                                                                                                                                                                                            |
| `≥ lg` (1024) | Auth pages become the two-column split: brand panel left, form right. Board grid goes to 3 columns.                                                                                                                                                                                                                                        |

Rules that keep it working:

- **The task dialog is height-constrained**: `max-h-[calc(100dvh-2rem)]` with the header and
  footer pinned and only the field group scrolling. Without this the Create / Cancel buttons
  become unreachable on a short viewport (small phones, any phone in landscape) because the
  dialog is `position: fixed` and the page scroll cannot reach it. Any new dialog with more
  than a few fields needs the same treatment.
- **User-generated text uses `wrap-anywhere`** on task titles and descriptions, and on board
  names and descriptions, so a long unbroken string cannot widen the row or the card.
- **The board card's link is stretched, not wrapping.** The whole tile is clickable via a
  `before:absolute before:inset-0` pseudo-element on the `<Link>`, and the actions menu opts
  back out with `relative`. Nesting the menu button inside an `<a>` instead would be invalid
  markup and would swallow its clicks.
- **The board view strip needs no `<Select>` fallback** — two tabs fit at 320px, unlike the
  five task filters.
- **Content max-width is `max-w-5xl`** on both the header and the page body so they stay
  aligned on wide screens.
- **Pagination never renders an unbounded row of buttons.** `pageWindow()` keeps first, last
  and the current page's neighbours, with `…` for the gaps, so a board with 40 pages still
  fits — and both ends stay one click away.
- When adding a filter or a summary card, re-check the tab strip still fits at 640 — it is
  the tightest constraint in the layout.

---

## 9. Conventions

- **Imports** use the `@/` alias, never `../../..`.
- **Files** are kebab-case; components are PascalCase; hooks are `use-*`.
- **Query keys** come from `taskKeys` / `boardKeys` — never write an inline array key.
  `taskKeys.list(params)` is keyed by the whole request — `(boardId, page, size, sort)` —
  because the server does the scoping now and two pages of one board are different responses.
  Mutations invalidate the `taskKeys.lists()` prefix so every cached page catches up.
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

- **Password reset has no email delivery.** The backend endpoints exist and the screens are
  wired to them, but `ResetpwTokenServiceImpl` only writes the token to the server log —
  nothing sends it anywhere. So the "Check your inbox" screen is aspirational: to exercise
  the flow, read the token out of the Spring Boot console and open
  `/reset-password?token=…` by hand. Nothing on the client changes when the mail service
  lands.
- **Forgot-password leaks whether an email is registered.** The screen's copy is
  deliberately conditional ("If an account exists for…"), but the backend answers an unknown
  address with `401 "Invalid email!"` instead of the same `200` it gives a known one — so
  the form shows a red alert that says the quiet part out loud. The fix is backend-side
  (return `200` either way); the client is already shaped for it and needs no change.
- **Overdue tasks cannot be edited or toggled.** The backend validates `dueDate` with
  `@Future` on update as well as create, so any `PUT` carrying a past deadline is
  rejected — including a plain status toggle. Removing `@Future` from `UpdateTaskDto` (or
  dropping it entirely) is the fix; the client cannot work around it.
- **The status filter and the search box are page-scoped.** `/task/all` accepts `boardId`,
  `page`, `size` and `sort` and nothing else, so both narrow the rows already fetched rather
  than the board. The summary caption and the pagination totals say so out loud. `?status=`
  and `?q=` on the backend delete `features/tasks/list.ts` outright.
- **Two sort options are missing because the backend cannot serve them.** `title` is not in
  `TaskServiceImpl.ALLOWED_SORT`, and `priority` is in it but sorts alphabetically —
  `Task.priority` is `@Enumerated(STRING)`, so the order is `HIGH, LOW, MEDIUM`. Priority
  needs an ordinal column (or `EnumType.ORDINAL` plus a migration) before it can come back;
  title needs one line in `ALLOWED_SORT`. `SORT_META` is where both land.
- **Sorting by "Due latest" opens with undated tasks.** Postgres puts NULLs first on a
  descending sort, and neither the repository query nor `Sorts.sanitize` sets a `NULLS`
  clause. Backend fix; the client cannot reorder a page it only partly holds.
- **`GET /task/all` does not start today.** `TaskRepository.findTasksByBoardOrderBy` is not a
  parseable derived-query name — Spring Data only splits the `OrderBy` keyword when an
  uppercase letter follows it, so the trailing `OrderBy` is read as a property and resolves
  to `board.orderBy`, which does not exist. It throws `PropertyReferenceException` while the
  repository bean is being created, so the **whole application fails to boot**; it compiles
  cleanly, which is why a build does not catch it. Renaming the method to `findByBoard` fixes
  it. Every screen in this app is blocked behind that one line.
- **Boards can be archived but never restored or deleted.** `DELETE` soft-deletes and nothing
  reverses it, so the UI exposes neither action. Restore needs `isArchived` on
  `UpdateBoardDto`; a real delete needs a second endpoint plus `ON DELETE CASCADE` on
  `tasks.board_id`, currently `NO ACTION`.
- **A task cannot be moved between boards.** `UpdateTaskDto` has no `boardId`. The picker is
  already built and merely `disabled` when editing.
- **There is no cross-board task list.** `boardId` is required on `/task/all`, so `/tasks`
  is a redirect to `/boards` and a task can only be seen inside its board. Making `boardId`
  optional — falling back to the principal's boards — restores the screen; the route file
  says what to rebuild.
- **Board cards show no task counts.** `BoardResponse` carries none, and the paginated,
  board-scoped task endpoint cannot supply them without a request per board. The progress bar
  was removed rather than left showing a wrong number. `taskCount` / `doneCount` on
  `BoardResponse` brings it back; `ArchiveBoardDialog` already degrades to copy without the
  count, and the board _detail_ page still passes a real total from `PagedResponse.total`.
- **Boards are sorted by title and cannot be reordered.** `BoardResponse` does carry
  `createdAt`, so ordering by age is available if wanted — unlike tasks.
- **Board search and the active/archived split are client-side**, like the task filters —
  `GET /board/all` takes no parameters. `features/boards/list.ts` goes away if it grows
  `?q=` and `?archived=`.
- **Archiving a board does not archive its tasks.** They stay live and stay reachable by
  opening the archived board. That is intended — archiving is about tidying the grid, not
  hiding work.
- **Nothing scopes tasks to the caller.** `GET /task/all`, `POST /task`, `GET /task/{id}` and
  `PUT /task/{id}` have no `@AuthenticationPrincipal` and no ownership guard, so any signed-in
  user can list, read or edit any task by UUID and create one into someone else's board.
  `TaskServiceImpl` has its own `getValidBoard(boardId)` that skips the check
  `BoardServiceImpl.getValidBoard(ownerId, boardId)` performs. The list endpoint is the worst
  of them: one guessed `boardId` returns a whole board, paginated.
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
