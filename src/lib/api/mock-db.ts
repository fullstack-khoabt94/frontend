import type { Task, TaskPriority, TaskStatus } from '@/features/tasks/schemas'
import type { User } from '@/features/auth/schemas'

export type MockUser = User & { password: string }

export type MockDb = {
  users: MockUser[]
  tasks: Task[]
  resetTokens: Record<string, string>
}

const DB_KEY = 'todo.mock-db'

export const DEMO_CREDENTIALS = {
  email: 'demo@todo.app',
  password: 'Password123',
}

const now = Date.now()
const iso = (offsetDays: number) => new Date(now + offsetDays * 86_400_000).toISOString()

function seedTask(
  id: string,
  title: string,
  description: string | null,
  status: TaskStatus,
  priority: TaskPriority,
  dueOffset: number | null,
  createdOffset: number,
): Task {
  return {
    id,
    title,
    description,
    status,
    priority,
    dueDate: dueOffset === null ? null : iso(dueOffset),
    createdAt: iso(createdOffset),
    updatedAt: iso(createdOffset),
  }
}

function seed(): MockDb {
  return {
    users: [
      {
        id: 'usr_demo',
        name: 'Demo User',
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
        avatarUrl: null,
        createdAt: iso(-30),
      },
    ],
    tasks: [
      seedTask('tsk_1', 'Draft the Q3 product roadmap', 'Collect input from design and engineering before the leadership review.', 'in_progress', 'high', 2, -3),
      seedTask('tsk_2', 'Review pull request #218', 'Auth refresh-token rotation.', 'todo', 'medium', 1, -2),
      seedTask('tsk_3', 'Write release notes for v1.4', null, 'todo', 'low', 5, -2),
      seedTask('tsk_4', 'Fix flaky checkout integration test', 'Fails roughly 1 in 8 runs on CI.', 'in_progress', 'high', -1, -6),
      seedTask('tsk_5', 'Set up staging database backups', null, 'done', 'medium', -4, -10),
      seedTask('tsk_6', 'Onboard the new frontend engineer', 'Access, repo walkthrough, first ticket.', 'done', 'low', -6, -12),
      seedTask('tsk_7', 'Plan the design system audit', 'List every component that still uses legacy tokens.', 'todo', 'medium', 9, -1),
    ],
    resetTokens: {},
  }
}

export function loadDb(): MockDb {
  try {
    const raw = window.localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    /* fall through to a fresh seed */
  }
  const fresh = seed()
  saveDb(fresh)
  return fresh
}

export function saveDb(db: MockDb) {
  window.localStorage.setItem(DB_KEY, JSON.stringify(db))
}

export function resetDb() {
  window.localStorage.removeItem(DB_KEY)
}

export function nextId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
