import { createAsync, useAction, useLocation, useSearchParams, useSubmission } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { BOOKS, bookByCode, type Testament } from "~/lib/books";
import { scopeBooksQuery, setScopeBookAction } from "~/lib/queries";
import { useCurrentTestament } from "~/lib/testament";
import type { LexiconParams } from "~/lib/url";

// "all:OT" / "all:NT" clear one testament's book; a book code sets the book of its testament.
const ALL: Record<Testament, string> = { OT: "all:OT", NT: "all:NT" };
const OPTIONS = [ALL.OT, ...BOOKS.filter(b => b.testament === "OT").map(b => b.code), ALL.NT, ...BOOKS.filter(b => b.testament === "NT").map(b => b.code)];
const label = (v: string | undefined) =>
  !v ? "" : v === ALL.OT ? "旧約すべて" : v === ALL.NT ? "新約すべて" : (bookByCode(v)?.ja ?? v);

const Placeholder = () => <div class="h-9 w-32 rounded-md border sm:w-40" aria-hidden="true" />;

/**
 * Header control: limits the word list (and the default concordance filter, memos, favourites) to one book.
 * One book is remembered per testament, so switching 新約／旧約 brings back each side's book. Saved in D1.
 * Shows the choice for the testament on screen; picking a book of the other testament switches the list to it.
 */
export function BookScopeSelect() {
  const location = useLocation();
  const [, setSearch] = useSearchParams<LexiconParams>();
  const testament = useCurrentTestament();
  const scopes = createAsync(() => scopeBooksQuery());
  const save = useAction(setScopeBookAction);
  const submission = useSubmission(setScopeBookAction);
  // Show the new choice immediately while it is being saved.
  const current = () => {
    const t = testament();
    if (submission.pending && submission.input?.[0] === t) return submission.input[1] ?? ALL[t];
    return scopes()?.[t] ?? ALL[t];
  };

  const onChange = (v: string | null) => {
    if (!v || v === current()) return;
    const target: Testament = v === ALL.OT ? "OT" : v === ALL.NT ? "NT" : bookByCode(v)!.testament;
    // On the lexicon page, restart paging, drop any explicit concordance filter and show the chosen testament.
    if (location.pathname === "/")
      setSearch({ page: undefined, cp: undefined, book: undefined, ...(target !== testament() ? { t: target === "OT" ? "ot" : undefined, l: undefined } : {}) });
    void save(target, v.startsWith("all:") ? null : v);
  };

  // Rendered once the stored value is known, and re-mounted when it changes: the Select then always
  // starts from the right value instead of relying on a controlled update across hydration.
  return (
    <Suspense fallback={<Placeholder />}>
      <Show when={scopes() !== undefined && current()} keyed fallback={<Placeholder />}>
        {value => (
          <Select
            value={value}
            onChange={onChange}
            options={OPTIONS}
            itemComponent={p => (
              <SelectItem item={p.item} class={p.item.rawValue.startsWith("all:") ? "font-medium" : ""}>
                {label(p.item.rawValue)}
              </SelectItem>
            )}
            aria-label="学習する書"
          >
            <SelectTrigger class="h-9 w-32 text-sm sm:w-40" aria-label="学習する書">
              <SelectValue<string>>{state => label(state.selectedOption())}</SelectValue>
            </SelectTrigger>
            <SelectContent class="max-h-96 overflow-y-auto" />
          </Select>
        )}
      </Show>
    </Suspense>
  );
}
