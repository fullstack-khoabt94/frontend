import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useSession } from '@/features/auth/session'
import { DeleteTaskDialog } from '@/features/tasks/components/delete-task-dialog'
import { TaskEmptyState } from '@/features/tasks/components/task-empty-state'
import { TaskFilterBar } from '@/features/tasks/components/task-filter-bar'
import { TaskFormDialog } from '@/features/tasks/components/task-form-dialog'
import { TaskItem, TaskItemSkeleton } from '@/features/tasks/components/task-item'
import { TaskSummary } from '@/features/tasks/components/task-summary'
import { FILTER_META } from '@/features/tasks/constants'
import {
  useCreateTask,
  useDeleteTask,
  useTaskList,
  useUpdateTask,
  useUpdateTaskStatus,
} from '@/features/tasks/queries'
import {
  taskSearchSchema,
  type Task,
  type TaskFormValues,
  type TaskStatus,
} from '@/features/tasks/schemas'

export const Route = createFileRoute('/_app/tasks')({
  // Filter / search / sort live in the URL, so every view is shareable.
  validateSearch: taskSearchSchema,
  component: TasksPage,
})

function TasksPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { user } = useSession()

  const [searchInput, setSearchInput] = useState(search.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [deletingTask, setDeletingTask] = useState<Task | undefined>()

  // Push the debounced keyword into the URL; the query key follows from there.
  useEffect(() => {
    if (debouncedSearch === search.q) return
    void navigate({ search: (previous) => ({ ...previous, q: debouncedSearch }), replace: true })
  }, [debouncedSearch, search.q, navigate])

  const list = useTaskList(search)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()

  const { tasks, stats } = list
  const isInitialLoading = list.isPending

  const openCreate = () => {
    setEditingTask(undefined)
    setFormOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  const handleSubmit = async (values: TaskFormValues) => {
    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, values })
    } else {
      await createTask.mutateAsync(values)
    }
    setFormOpen(false)
  }

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    if (task.status === status) return
    updateStatus.mutate({ task, status })
  }

  const handleDelete = () => {
    if (!deletingTask) return
    deleteTask.mutate(
      { id: deletingTask.id, title: deletingTask.title },
      { onSettled: () => setDeletingTask(undefined) },
    )
  }

  const firstName = user?.name.split(' ')[0] ?? 'there'

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Hi {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">
            {stats?.not_done
              ? `You have ${stats.not_done} task${stats.not_done === 1 ? '' : 's'} left to finish.`
              : 'Everything is up to date. Add a task to get going.'}
          </p>
        </div>
        <Button size="lg" className="h-10 shrink-0" onClick={openCreate}>
          <Plus className="size-4" />
          New task
        </Button>
      </div>

      <div className="space-y-8">
        <TaskSummary stats={stats} isLoading={isInitialLoading} />

        <section className="space-y-4">
          <TaskFilterBar
            filter={search.filter}
            onFilterChange={(filter) =>
              void navigate({ search: (previous) => ({ ...previous, filter }) })
            }
            search={searchInput}
            onSearchChange={setSearchInput}
            sort={search.sort}
            onSortChange={(sort) =>
              void navigate({ search: (previous) => ({ ...previous, sort }) })
            }
            stats={stats}
          />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {FILTER_META[search.filter].label}
              {stats ? ` · ${tasks.length}` : ''}
            </h2>
            <p className="text-xs text-muted-foreground">
              {FILTER_META[search.filter].description}
            </p>
          </div>

          {isInitialLoading ? (
            <ul className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <TaskItemSkeleton key={index} />
              ))}
            </ul>
          ) : tasks.length === 0 ? (
            <TaskEmptyState
              filter={search.filter}
              search={search.q}
              onCreate={openCreate}
              onClearSearch={() => setSearchInput('')}
            />
          ) : (
            <ul className="space-y-3" aria-busy={list.isFetching}>
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onEdit={openEdit}
                  onDelete={setDeletingTask}
                  onStatusChange={handleStatusChange}
                  isMutating={deleteTask.isPending && deleteTask.variables?.id === task.id}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        onSubmit={handleSubmit}
        isPending={createTask.isPending || updateTask.isPending}
      />

      <DeleteTaskDialog
        task={deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(undefined)}
        onConfirm={handleDelete}
        isPending={deleteTask.isPending}
      />
    </main>
  )
}
