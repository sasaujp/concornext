import { createAsync, useAction, useSubmission } from "@solidjs/router";
import { NotebookPen, Pencil } from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { TextField, TextFieldInput } from "~/components/ui/text-field";
import { bookByCode } from "~/lib/books";
import { saveNoteAction, scopeBookQuery } from "~/lib/queries";
import type { LemmaNote } from "~/server/lexicon";

const MAX = 200;
const bookName = (code: string) => bookByCode(code)?.ja ?? code;

/**
 * One-line memo for a lemma, kept per book (e.g. where it is written up in that book's notebook).
 * With a book chosen in the header the memo for that book can be edited; with "all books" every
 * book's memo is listed read-only.
 */
export function NoteEditor(props: { strongsId: string; notes: LemmaNote[] }) {
  const scope = createAsync(() => scopeBookQuery());
  const save = useAction(saveNoteAction);
  const submission = useSubmission(saveNoteAction, ([id]) => id === props.strongsId);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let input: HTMLInputElement | undefined;

  const current = () => props.notes.find(n => n.book === scope())?.note ?? null;
  const start = () => {
    setDraft(current() ?? "");
    setEditing(true);
    queueMicrotask(() => input?.focus());
  };
  const commit = async (book: string) => {
    await save(props.strongsId, book, draft());
    setEditing(false);
  };

  return (
    <div class="flex min-h-10 items-start gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
      <NotebookPen class="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Show
        when={scope()}
        fallback={
          <div class="min-w-0 flex-1 py-1.5">
            <Show
              when={props.notes.length}
              fallback={<span class="text-muted-foreground">メモなし（ヘッダーで書を選ぶと、その書のメモを書けます）</span>}
            >
              <ul class="space-y-1">
                <For each={props.notes}>
                  {n => (
                    <li class="flex flex-wrap items-baseline gap-2">
                      <Badge variant="secondary" class="font-normal">
                        {bookName(n.book)}
                      </Badge>
                      <span class="break-words">{n.note}</span>
                    </li>
                  )}
                </For>
              </ul>
              <p class="mt-1 text-xs text-muted-foreground">メモを書き換えるには、ヘッダーでその書を選んでください。</p>
            </Show>
          </div>
        }
      >
        {book => (
          <Show
            when={editing()}
            fallback={
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <Badge variant="secondary" class="shrink-0 font-normal">
                  {bookName(book())}
                </Badge>
                <Show when={current()} fallback={<span class="flex-1 text-muted-foreground">メモなし</span>}>
                  <span class="min-w-0 flex-1 break-words">{current()}</span>
                </Show>
                <Button variant="ghost" size="sm" class="h-8 shrink-0" onClick={start}>
                  <Pencil class="size-3.5" aria-hidden="true" />
                  {current() ? "編集" : "メモを追加"}
                </Button>
              </div>
            }
          >
            <form
              class="flex flex-1 flex-wrap items-center gap-2"
              onSubmit={e => {
                e.preventDefault();
                void commit(book());
              }}
            >
              <Badge variant="secondary" class="shrink-0 font-normal">
                {bookName(book())}
              </Badge>
              <TextField class="min-w-48 flex-1" value={draft()} onChange={setDraft}>
                <TextFieldInput
                  ref={input}
                  class="h-8"
                  maxLength={MAX}
                  placeholder="例: ノート1巻 p.4-7"
                  aria-label={`${bookName(book())}のメモ（1行）`}
                  onKeyDown={(e: KeyboardEvent) => e.key === "Escape" && setEditing(false)}
                />
              </TextField>
              <Button type="submit" size="sm" class="h-8" disabled={submission.pending}>
                保存
              </Button>
              <Button type="button" variant="ghost" size="sm" class="h-8" onClick={() => setEditing(false)}>
                キャンセル
              </Button>
            </form>
          </Show>
        )}
      </Show>
      <Show when={submission.error}>
        <span class="text-xs text-destructive" role="alert">
          保存できませんでした
        </span>
      </Show>
    </div>
  );
}
