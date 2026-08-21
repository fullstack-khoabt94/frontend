import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { Task, TaskFilter, TaskSort } from '@/features/tasks/schemas'
import { DEMO_CREDENTIALS, loadDb, nextId, saveDb, type MockDb, type MockUser } from './mock-db'

/**
 * A localStorage-backed fake backend wired in as an axios adapter.
 *
 * It exists so the UI is fully explorable before the real API lands. Deleting
 * this file plus the `adapter` option in `client.ts` is the entire removal.
 */

const LATENCY = 320

function delay<T>(value: T, ms = LATENCY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

function ok<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  }
}

function fail(config: InternalAxiosRequestConfig, status: number, message: string): never {
  const response: AxiosResponse = {
    data: { message },
    status,
    statusText: message,
    headers: new AxiosHeaders(),
    config,
  }
  throw new AxiosError(message, String(status), config, null, response)
}

function body<T>(config: InternalAxiosRequestConfig): T {
  if (!config.data) return {} as T
  return typeof config.data === 'string' ? (JSON.parse(config.data) as T) : (config.data as T)
}

function currentUser(config: InternalAxiosRequestConfig, db: MockDb): MockUser {
  const header = config.headers?.Authorization
  const token = typeof header === 'string' ? header.replace('Bearer ', '') : ''
  const user = db.users.find((candidate) => token === `token_${candidate.id}`)
  if (!user) fail(config, 401, 'Your session has expired. Please sign in again.')
  return user
}

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 } as const

function matchesFilter(task: Task, filter: TaskFilter) {
  switch (filter) {
    case 'all':
      return true
    case 'not_done':
      return task.status !== 'done'
    default:
      return task.status === filter
  }
}

function sortTasks(tasks: Task[], sort: TaskSort) {
  const copy = [...tasks]
  switch (sort) {
    case 'created_asc':
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'due_asc':
      return copy.sort((a, b) => {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    case 'priority_desc':
      return copy.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    case 'created_desc':
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
}

function publicUser(user: MockUser) {
  const { password: _password, ...rest } = user
  return rest
}

export const mockAdapter: AxiosAdapter = async (config) => {
  const db = loadDb()
  const method = (config.method ?? 'get').toLowerCase()
  const url = (config.url ?? '').split('?')[0]
  const nowIso = new Date().toISOString()

  /* ------------------------------- auth ------------------------------- */

  if (url === '/auth/login' && method === 'post') {
    const { email, password } = body<{ email: string; password: string }>(config)
    const user = db.users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase())
    if (!user || user.password !== password) {
      await delay(null)
      fail(config, 401, 'Incorrect email or password.')
    }
    return delay(ok(config, { accessToken: `token_${user.id}`, user: publicUser(user) }))
  }

  if (url === '/auth/signup' && method === 'post') {
    const { name, email, password } = body<{ name: string; email: string; password: string }>(config)
    if (db.users.some((candidate) => candidate.email.toLowerCase() === email.toLowerCase())) {
      await delay(null)
      fail(config, 409, 'An account with this email already exists.')
    }
    const user: MockUser = {
      id: nextId('usr'),
      name,
      email,
      password,
      avatarUrl: null,
      createdAt: nowIso,
    }
    db.users.push(user)
    saveDb(db)
    return delay(ok(config, { accessToken: `token_${user.id}`, user: publicUser(user) }, 201))
  }

  if (url === '/auth/logout' && method === 'post') {
    return delay(ok(config, null, 204), 120)
  }

  if (url === '/auth/me' && method === 'get') {
    const user = currentUser(config, db)
    return delay(ok(config, publicUser(user)), 120)
  }

  if (url === '/auth/forgot-password' && method === 'post') {
    const { email } = body<{ email: string }>(config)
    const user = db.users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase())
    if (user) {
      // Real backend emails this token; the mock hands it back so the reset
      // screen is reachable without a mail server.
      const token = nextId('rst')
      db.resetTokens[token] = user.id
      saveDb(db)
      return delay(ok(config, { message: 'Reset link sent.', debugToken: token }))
    }
    // Never confirm whether an email is registered.
    return delay(ok(config, { message: 'Reset link sent.' }))
  }

  if (url === '/auth/reset-password' && method === 'post') {
    const { token, password } = body<{ token: string; password: string }>(config)
    const userId = db.resetTokens[token]
    if (!userId) {
      await delay(null)
      fail(config, 400, 'This reset link is invalid or has expired.')
    }
    const user = db.users.find((candidate) => candidate.id === userId)
    if (!user) fail(config, 400, 'This reset link is invalid or has expired.')
    user.password = password
    delete db.resetTokens[token]
    saveDb(db)
    return delay(ok(config, { message: 'Password updated.' }))
  }

  /* ------------------------------- tasks ------------------------------ */

  if (url === '/tasks' && method === 'get') {
    currentUser(config, db)
    const params = (config.params ?? {}) as { filter?: TaskFilter; q?: string; sort?: TaskSort }
    const filter = params.filter ?? 'all'
    const q = (params.q ?? '').toLowerCase()

    const searched = db.tasks.filter(
      (task) =>
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description ?? '').toLowerCase().includes(q),
    )
    const data = sortTasks(searched.filter((task) => matchesFilter(task, filter)), params.sort ?? 'created_desc')

    return delay(
      ok(config, {
        data,
        stats: {
          all: searched.length,
          not_done: searched.filter((task) => task.status !== 'done').length,
          todo: searched.filter((task) => task.status === 'todo').length,
          in_progress: searched.filter((task) => task.status === 'in_progress').length,
          done: searched.filter((task) => task.status === 'done').length,
        },
      }),
    )
  }

  if (url === '/tasks' && method === 'post') {
    currentUser(config, db)
    const input = body<Partial<Task>>(config)
    const task: Task = {
      id: nextId('tsk'),
      title: input.title ?? 'Untitled task',
      description: input.description ?? null,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
      createdAt: nowIso,
      updatedAt: nowIso,
    }
    db.tasks.unshift(task)
    saveDb(db)
    return delay(ok(config, task, 201))
  }

  const taskMatch = url.match(/^\/tasks\/([^/]+)(\/status)?$/)
  if (taskMatch) {
    currentUser(config, db)
    const [, id] = taskMatch
    const index = db.tasks.findIndex((task) => task.id === id)
    if (index === -1) {
      await delay(null)
      fail(config, 404, 'This task no longer exists.')
    }

    if (method === 'delete') {
      const [removed] = db.tasks.splice(index, 1)
      saveDb(db)
      return delay(ok(config, removed))
    }

    if (method === 'patch' || method === 'put') {
      const patch = body<Partial<Task>>(config)
      const updated: Task = { ...db.tasks[index], ...patch, id, updatedAt: nowIso }
      db.tasks[index] = updated
      saveDb(db)
      return delay(ok(config, updated), 180)
    }
  }

  await delay(null, 0)
  fail(config, 404, `Mock API has no handler for ${method.toUpperCase()} ${url}`)
}

export { DEMO_CREDENTIALS }
