import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { DeleteTagDialog } from '@/features/tags/components/delete-tag-dialog'
import { TagChip } from '@/features/tags/components/tag-chip'
import { TagEmptyState } from '@/features/tags/components/tag-empty-state'
import { TagFormDialog } from '@/features/tags/components/tag-form-dialog'
import {
  toDeleteVariables,
  useCreateTag,
  useDeleteTag,
  useTagSearch,
  useUpdateTag,
} from '@/features/tags/queries'
import { tagSearchSchema, type Tag, type TagFormValues } from '@/features/tags/schemas'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/tags')({
  // The search box lives in the URL, so a filtered library is linkable —
  // the same rule the board grid and the task list follow.
  validateSearch: tagSearchSchema,
  component: TagsPage,
})

/**
 * The tag library.
 *
 * A flat list rather than a grid: a tag is a name, a colour and a sentence, so
 * a card would be mostly padding. It reads as rows for the same reason the task
 * list does.
 *
 * Unlike `/boards/$boardId`, nothing here is paginated or server-filtered —
 * `GET /tag/all` takes no parameters and returns the lot, so searching is a
 * client-side view over one cached response, exactly as the board grid works.
 * If tag libraries ever grow big enough for that to hurt, the fix is `?q=` and
 * `?page=` on the endpoint, and `useTagSearch` is the only caller to rewrite.
 */
function TagsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const [searchInput, setSearchInput] = useState(search.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | undefined>()
  const [deletingTag, setDeletingTag] = useState<Tag | undefined>()

  useEffect(() => {
    if (debouncedSearch === search.q) return
    void navigate({ search: (previous) => ({ ...previous, q: debouncedSearch }), replace: true })
  }, [debouncedSearch, search.q, navigate])

  const list = useTagSearch(search)
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()

  const openCreate = () => {
    setEditingTag(undefined)
    setFormOpen(true)
  }

  const openEdit = (tag: Tag) => {
    setEditingTag(tag)
    setFormOpen(true)
  }

  const handleSubmit = async (values: TagFormValues) => {
    if (editingTag) {
      await updateTag.mutateAsync({ id: editingTag.id, values })
    } else {
      await createTag.mutateAsync(values)
    }
    setFormOpen(false)
  }

  const handleDelete = () => {
    if (!deletingTag) return
    deleteTag.mutate(toDeleteVariables(deletingTag), {
      onSettled: () => setDeletingTag(undefined),
    })
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tags</h1>
          <p className="text-sm text-muted-foreground">
            Labels you can put on any task, on any board.
          </p>
        </div>
        <Button size="lg" className="h-10 shrink-0" onClick={openCreate}>
          <Plus className="size-4" />
          New tag
        </Button>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search tags…"
            aria-label="Search tags"
            className="h-10 pr-9 pl-9"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={() => setSearchInput('')}
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        {list.isPending ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((index) => (
              <TagRowSkeleton key={index} />
            ))}
          </ul>
        ) : list.tags.length === 0 ? (
          <TagEmptyState
            search={search.q}
            onCreate={openCreate}
            onClearSearch={() => setSearchInput('')}
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {search.q
                ? `${list.tags.length} of ${list.total} tags`
                : `${list.total} tag${list.total === 1 ? '' : 's'}`}
            </p>
            <ul className="space-y-3" aria-busy={list.isFetching}>
              {list.tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  onEdit={openEdit}
                  onDelete={setDeletingTag}
                  isMutating={deleteTag.isPending && deletingTag?.id === tag.id}
                />
              ))}
            </ul>
          </>
        )}
      </div>

      <TagFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tag={editingTag}
        onSubmit={handleSubmit}
        isPending={createTag.isPending || updateTag.isPending}
        // The unfiltered list, not the searched one: a name can collide with a
        // tag the current search is hiding.
        existingTags={list.data}
      />

      <DeleteTagDialog
        tag={deletingTag}
        onOpenChange={(open) => !open && setDeletingTag(undefined)}
        onConfirm={handleDelete}
        isPending={deleteTag.isPending}
      />
    </main>
  )
}

type RowProps = {
  tag: Tag
  onEdit: (tag: Tag) => void
  onDelete: (tag: Tag) => void
  isMutating?: boolean
}

function TagRow({ tag, onEdit, onDelete, isMutating }: RowProps) {
  return (
    // The whole row is not a link: a tag has no detail page — `/tag/{id}`
    // exists on the API but would only show what this row already says.
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors sm:gap-4 sm:p-5',
        'hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-accent/40',
        isMutating && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <TagChip tag={tag} className="max-w-full text-sm" />
        {tag.description && (
          <p className="text-sm text-muted-foreground wrap-anywhere">{tag.description}</p>
        )}
        {/* Guarded: `createdAt` is null on a tag that arrived nested in a
            create-task response. On this screen it always comes from
            `GET /tag/all` and is populated, but the type is honest about it. */}
        {tag.createdAt && (
          <p className="text-xs text-muted-foreground">Created {formatDate(tag.createdAt)}</p>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
          onClick={() => onEdit(tag)}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${tag.title}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => onEdit(tag)}>
              <Pencil className="size-4" />
              Edit tag
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(tag)}>
              <Trash2 className="size-4" />
              Delete tag
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

function TagRowSkeleton() {
  return (
    <li className="flex items-start gap-4 rounded-xl border bg-card p-5">
      <div className="flex-1 space-y-2.5">
        <span className="block h-5 w-24 animate-pulse rounded-full bg-muted" />
        <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
        <span className="block h-3 w-28 animate-pulse rounded bg-muted" />
      </div>
    </li>
  )
}
