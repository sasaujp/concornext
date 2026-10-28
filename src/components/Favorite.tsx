import { createAsync, useAction, useSubmission, useSubmissions } from "@solidjs/router";
import { NotebookPen, Pencil, Star } from "lucide-solid";
import { createSignal, onCleanup, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import { TextField, TextFieldTextArea } from "~/components/ui/text-field";
import { displayRef } from "~/lib/books";
import { favoritesQuery, saveFavoriteNoteAction, setFavoriteAction, type Favorite } from "~/lib/queries";
import { cn } from "~/lib/utils";

const MAX = 4000;

export type VerseKey = { book: string; chapter: number; verse: number };
export const verseKey = (r: VerseKey) => `${r.book}.${r.chapter}.${r.verse}`;

/** The user's favourites by "Book.C.V", with pending star toggles applied optimistically. */
export function useFavorites() {
  const list = createAsync(() => favoritesQuery());
  const pending = useSubmissions(setFavoriteAction);
  const map = () => new Map((list() ?? []).map(f => [verseKey(f), f]));
  const isFavorite = (r: VerseKey) => {
    const key = verseKey(r);
    // The latest pending toggle for this verse wins.
    const p = [...pending].reverse().find(s => s.pending && verseKey({ book: s.input[0], chapter: s.input[1], verse: s.input[2] }) === key);
    return p ? p.input[3] : map().has(key);
  };
  const get = (r: VerseKey): Favorite | undefined => map().get(verseKey(r));
  return { list, isFavorite, get };
}

/**
 * Star toggle for one verse. Removing a favourite also removes its memo, so when there is a memo
 * the first click only asks for confirmation (an inline button, no browser dialog).
 */
export function FavoriteButton(props: VerseKey & { class?: string; /** Show the confirmation below the star (for narrow columns). */ confirmBelow?: boolean }) {
  const favs = useFavorites();
  const toggle = useAction(setFavoriteAction);
  const [confirming, setConfirming] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  const on = () => favs.isFavorite(props);
  const hasNote = () => !!favs.get(props)?.note;
  const ref = () => displayRef(props.book, props.chapter, props.verse);
  const set = (value: boolean) => {
    setConfirming(false);
    void toggle(props.book, props.chapter, props.verse, value);
  };
  const onClick = () => {
    if (!on()) return set(true);
    if (!hasNote() || confirming()) return set(false);
    setConfirming(true);
    clearTimeout(timer);
    timer = setTimeout(() => setConfirming(false), 4000);
  };

  return (
    <span class={cn("inline-flex items-center gap-1", props.confirmBelow && "relative")}>
      <button
        type="button"
        class={cn("inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", props.class)}
        aria-pressed={on()}
        aria-label={on() ? `${ref()} をお気に入りから外す` : `${ref()} をお気に入りに追加`}
        title={on() ? "お気に入りから外す" : "お気に入りに追加"}
        onClick={onClick}
      >
        <Star class={cn("size-4", on() && "fill-amber-400 text-amber-500")} aria-hidden="true" />
      </button>
      <Show when={confirming()}>
        <button
          type="button"
          class={cn(
            "whitespace-nowrap rounded bg-destructive px-1.5 py-0.5 font-sans text-[11px] font-medium text-destructive-foreground",
            props.confirmBelow && "absolute left-0 top-full z-10 mt-0.5 shadow",
          )}
          onClick={() => set(false)}
        >
          メモごと外す
        </button>
      </Show>
    </span>
  );
}

/** Free-text memo for a favourite verse (several lines). Writing a memo on a verse that is not a favourite yet adds it. */
export function FavoriteNote(props: VerseKey & { class?: string }) {
  const favs = useFavorites();
  const save = useAction(saveFavoriteNoteAction);
  const submission = useSubmission(saveFavoriteNoteAction, ([b, c, v]) => verseKey({ book: b, chapter: c, verse: v }) === verseKey(props));
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let input: HTMLTextAreaElement | undefined;

  const current = () => favs.get(props)?.note ?? null;
  const start = () => {
    setDraft(current() ?? "");
    setEditing(true);
    queueMicrotask(() => input?.focus());
  };
  const commit = async () => {
    await save(props.book, props.chapter, props.verse, draft());
    setEditing(false);
  };

  return (
    <div class={cn("flex min-h-10 items-start gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm", props.class)}>
      <NotebookPen class="mt-2 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Show
        when={editing()}
        fallback={
          <div class="flex min-w-0 flex-1 items-start gap-2">
            <Show when={current()} fallback={<span class="flex-1 py-1.5 text-muted-foreground">メモなし</span>}>
              <p class="min-w-0 flex-1 whitespace-pre-wrap break-words py-1.5">{current()}</p>
            </Show>
            <Button variant="ghost" size="sm" class="h-8 shrink-0" onClick={start}>
              <Pencil class="size-3.5" aria-hidden="true" />
              {current() ? "編集" : "メモを追加"}
            </Button>
          </div>
        }
      >
        <form
          class="flex min-w-0 flex-1 flex-col gap-2 py-1"
          onSubmit={e => {
            e.preventDefault();
            void commit();
          }}
        >
          <TextField value={draft()} onChange={setDraft}>
            <TextFieldTextArea
              ref={input}
              class="min-h-28 resize-y"
              maxLength={MAX}
              placeholder={"例: 受肉。ノート2巻 p.12\n気づいたことを自由に"}
              aria-label={`${displayRef(props.book, props.chapter, props.verse)} のメモ`}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Escape") setEditing(false);
                // ⌘/Ctrl+Enter saves; plain Enter is a line break.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void commit();
                }
              }}
            />
          </TextField>
          <div class="flex items-center gap-2">
            <Button type="submit" size="sm" class="h-8" disabled={submission.pending}>
              保存
            </Button>
            <Button type="button" variant="ghost" size="sm" class="h-8" onClick={() => setEditing(false)}>
              キャンセル
            </Button>
            <span class="ml-auto hidden text-xs text-muted-foreground sm:inline">⌘/Ctrl + Enter で保存</span>
          </div>
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
