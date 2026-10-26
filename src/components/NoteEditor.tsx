import { useAction, useSubmission } from "@solidjs/router";
import { NotebookPen, Pencil } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { TextField, TextFieldInput } from "~/components/ui/text-field";
import { saveNoteAction } from "~/lib/queries";

const MAX = 200;

/** One-line memo for a lemma (e.g. where it is written up in the learner's own notebook). */
export function NoteEditor(props: { strongsId: string; note: string | null }) {
  const save = useAction(saveNoteAction);
  const submission = useSubmission(saveNoteAction, ([id]) => id === props.strongsId);
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let input: HTMLInputElement | undefined;

  const start = () => {
    setDraft(props.note ?? "");
    setEditing(true);
    queueMicrotask(() => input?.focus());
  };
  const commit = async () => {
    await save(props.strongsId, draft());
    setEditing(false);
  };

  return (
    <div class="flex min-h-10 items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
      <NotebookPen class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Show
        when={editing()}
        fallback={
          <>
            <Show when={props.note} fallback={<span class="flex-1 text-muted-foreground">メモなし</span>}>
              <span class="min-w-0 flex-1 break-words">{props.note}</span>
            </Show>
            <Button variant="ghost" size="sm" class="h-8 shrink-0" onClick={start}>
              <Pencil class="size-3.5" aria-hidden="true" />
              {props.note ? "編集" : "メモを追加"}
            </Button>
          </>
        }
      >
        <form
          class="flex flex-1 flex-wrap items-center gap-2"
          onSubmit={e => {
            e.preventDefault();
            void commit();
          }}
        >
          <TextField class="min-w-48 flex-1" value={draft()} onChange={setDraft}>
            <TextFieldInput
              ref={input}
              class="h-8"
              maxLength={MAX}
              placeholder="例: ノート1巻 p.4-7"
              aria-label="メモ（1行）"
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
      <Show when={submission.error}>
        <span class="text-xs text-destructive" role="alert">
          保存できませんでした
        </span>
      </Show>
    </div>
  );
}
