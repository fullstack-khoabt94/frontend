import { api } from '@/lib/api/client'
import {
  FILTER_STATUSES,
  pagedTaskListSchema,
  taskSchema,
  TASK_SORT_PARAM,
  type PagedTasks,
  type Task,
  type TaskFilter,
  type TaskFormValues,
  type TaskPriority,
  type TaskSort,
  type TaskStatus,
} from './schemas'

/**
 * The backend maps `dueDate` to a Java `LocalDateTime`, whose default Jackson
 * deserialiser is ISO_LOCAL_DATE_TIME — a trailing `Z` fails to parse. So the
 * date input's "yyyy-MM-dd" becomes a zone-less local timestamp, not an
 * `Instant`-style UTC string.
 */
function toLocalDateTime(date: string | undefined) {
  return date ? `${date}T00:00:00` : null
}

/**
 * The tags, in the shape both task DTOs actually declare.
 *
 * `CreateTaskDto` and `UpdateTaskDto` type this field as `Set<Tag>` — the JPA
 * **entity**, not a DTO and not a list of ids — so Jackson binds each object to
 * a `Tag` and Hibernate writes a `task_tags` row from its `id`. Three
 * consequences the client has to live with:
 *
 * - **`id` is mandatory.** `@ManyToMany` does not cascade PERSIST, so a tag
 *   arriving without one is transient and the save fails with
 *   `TransientObjectException`. Every tag here comes from `GET /tag/all`, so it
 *   always has one.
 * - **The other fields are sent but never written.** No cascade means Hibernate
 *   reads the id and ignores the rest; they are included because a bare
 *   `{ id }` relies on that being true, and the timestamps are dropped because
 *   they are the only fields whose format could fail to bind.
 * - **Ownership is not checked server-side.** `TaskServiceImpl` calls
 *   `setTags(dto.tags())` without verifying that each tag's owner is the caller,
 *   so the API would happily attach another user's tag by id. The client only
 *   ever offers tags from `GET /tag/all`, which is scoped to the principal, so
 *   nothing wrong is sent from here — but this is a client-side constraint on a
 *   server-side hole, not a fix for it. The fix is `Set<UUID> tagIds` plus an
 *   ownership check in the service.
 */
function toTagPayload(tags: TaskFormValues['tags']) {
  return tags.map((tag) => ({
    id: tag.id,
    title: tag.title,
    description: tag.description,
    color: tag.color,
  }))
}

/** Fields common to CreateTaskDto and UpdateTaskDto. */
function toPayload(values: TaskFormValues) {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    dueDate: toLocalDateTime(values.dueDate),
    /**
     * **Always an array, never `null` or omitted.** `tags` is `@Nullable` on
     * both DTOs and `TaskServiceImpl` assigns it straight through with
     * `setTags(dto.tags())`, which overwrites the entity's initialised
     * `HashSet` with `null`. `TaskResponse.fromTask` then calls
     * `task.getTags().stream()` on it — an NPE, and a 500 on the most ordinary
     * request there is: creating a task with no tags. Sending `[]` is what
     * keeps that path from ever being taken.
     */
    tags: toTagPayload(values.tags),
  }
}

/**
 * Tasks are a **nested resource**: every route is `/board/{boardId}/task/…`, so
 * the board is a path segment on all five calls rather than a query parameter
 * or a body field.
 *
 * That is what enforces ownership. `TaskServiceImpl.getValidTask` checks two
 * things — the caller owns `{boardId}`, and `{taskId}` belongs to that same
 * board — so a task can only be reached through the board that holds it. There
 * is no un-scoped `/task/{id}` to fall back to.
 */
function taskPath(boardId: string, taskId?: string) {
  return taskId ? `/board/${boardId}/task/${taskId}` : `/board/${boardId}/task`
}

/**
 * Repeating a query parameter — `?statuses=TODO&statuses=IN_PROGRESS`.
 *
 * Axios's default array format is `statuses[]=TODO`, and Spring binds
 * `@ModelAttribute QueryTasksDto` by the plain property name, so the bracketed
 * form silently binds nothing: the filter would be dropped and the response
 * would look like "All tasks". `indexes: null` is what removes the brackets.
 *
 * Scoped to the two list calls rather than set on the shared client, because it
 * changes how *every* array param on a request is written and no other endpoint
 * takes one today.
 */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const

/** The filters the list endpoint understands, minus paging and sorting. */
type TaskQuery = {
  filter: TaskFilter
  /** The search box. Sent as `search`, matched against the title only. */
  q: string
  priority?: TaskPriority
  /**
   * `yyyy-MM-dd`, inclusive of that whole day — the backend compares against
   * `dueOnOrBefore.atStartOfDay().plusDays(1)`.
   *
   * It **excludes undated tasks**: `due_date IS NULL` fails the comparison, so
   * a task with no deadline is never "due before" anything. That is the right
   * default for the question being asked, and the control says so on screen.
   */
  dueOnOrBefore?: string
  /** Tag ids, matched with OR. Sent as repeated `tags=` params. */
  tags?: string[]
}

/**
 * Turns the URL's view into `QueryTasksDto`.
 *
 * Empty values become `undefined` rather than `''` or `[]` so axios leaves them
 * off the wire entirely — the backend treats a missing parameter and a blank one
 * the same way (`StringUtils.hasText`, a null check), but an absent one keeps
 * the URL and the React Query key clean.
 */
function toQueryParams({ filter, q, priority, dueOnOrBefore, tags }: TaskQuery) {
  return {
    statuses: FILTER_STATUSES[filter],
    search: q || undefined,
    priority,
    dueOnOrBefore,
    tags: tags?.length ? tags : undefined,
  }
}

/** Everything the list endpoint accepts. `boardId` is the path, not a param. */
export type TaskListParams = TaskQuery & {
  boardId: string
  /** One-based, as it appears in the URL. Converted for Spring below. */
  page: number
  size: number
  sort: TaskSort
}

/**
 * A single status's total, for the tab badges and the summary cards.
 *
 * `search` and `priority` are carried along deliberately: a badge has to answer
 * "how many rows would I get if I clicked this tab", and clicking it does not
 * clear the search box.
 */
export type TaskCountParams = {
  boardId: string
  status: TaskStatus
  q: string
  priority?: TaskPriority
  dueOnOrBefore?: string
  tags?: string[]
}

export const tasksApi = {
  /**
   * One page of a board's tasks, already filtered by the server.
   *
   * Three translations happen here and nowhere else: the one-based page the URL
   * carries becomes Spring's zero-based `page`, the client's sort id becomes a
   * `property,direction` pair the `PageableHandlerMethodArgumentResolver`
   * understands, and the tab id becomes the `statuses` list
   * `TaskSpecification` filters on.
   */
  async list({ boardId, page, size, sort, ...query }: TaskListParams): Promise<PagedTasks> {
    const { data } = await api.get(`${taskPath(boardId)}/all`, {
      params: {
        page: page - 1,
        size,
        sort: TASK_SORT_PARAM[sort],
        ...toQueryParams(query),
      },
      paramsSerializer: REPEAT_ARRAY_PARAMS,
    })
    return pagedTaskListSchema.parse(data)
  },

  /**
   * How many tasks a status holds, without fetching them.
   *
   * There is no count endpoint, so this is the list endpoint asked for the
   * smallest page it will serve and read for `total` — one row down the wire per
   * call. Crude, but honest: the number comes from the database rather than from
   * counting the rows that happen to be on screen.
   */
  async count({
    boardId,
    status,
    q,
    priority,
    dueOnOrBefore,
    tags,
  }: TaskCountParams): Promise<number> {
    const { data } = await api.get(`${taskPath(boardId)}/all`, {
      params: {
        page: 0,
        size: 1,
        statuses: [status],
        search: q || undefined,
        priority,
        dueOnOrBefore,
        tags: tags?.length ? tags : undefined,
      },
      paramsSerializer: REPEAT_ARRAY_PARAMS,
    })
    return pagedTaskListSchema.parse(data).total
  },

  async getById(boardId: string, id: string): Promise<Task> {
    const { data } = await api.get(taskPath(boardId, id))
    return taskSchema.parse(data)
  },

  /**
   * **`boardId` is not in the body.** `CreateTaskDto` dropped the field when the
   * routes nested — the board comes off the path and is authorised there, so a
   * body field would be a second, unchecked source of the same fact.
   */
  async create(boardId: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.post(taskPath(boardId), toPayload(values))
    return taskSchema.parse(data)
  },

  /**
   * Full replace — the backend exposes PUT, and UpdateTaskDto requires every
   * field.
   *
   * A task still **cannot change board**: `updateTask` reads `{boardId}` only to
   * authorise the call and never reassigns `task.board`, so the path board must
   * be the one the task is already in — any other value fails the ownership
   * check with a 404 rather than moving the task.
   */
  async update(boardId: string, id: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.put(taskPath(boardId, id), toPayload(values))
    return taskSchema.parse(data)
  },

  async remove(boardId: string, id: string): Promise<void> {
    await api.delete(taskPath(boardId, id))
  },
}
