import { createAsync, useAction, useLocation, useSearchParams, useSubmission } from "@solidjs/router";
import { Show, Suspense } from "solid-js";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { BOOKS, bookByCode } from "~/lib/books";
import { scopeBookQuery, setScopeBookAction } from "~/lib/queries";
import type { LexiconParams } from "~/lib/url";

const ALL = "all";
const OPTIONS = [ALL, ...BOOKS.map(b => b.code)];
const label = (code: string | undefined) => (!code || code === ALL ? "すべての書" : (bookByCode(code)?.ja ?? code));

const Placeholder = () => <div class="h-9 w-32 rounded-md border sm:w-40" aria-hidden="true" />;

/** Header control: limits the word list (and the default concordance filter) to one book. Saved in D1. */
export function BookScopeSelect() {
  const location = useLocation();
  const [, setSearch] = useSearchParams<LexiconParams>();
  const scope = createAsync(() => scopeBookQuery());
  const save = useAction(setScopeBookAction);
  const submission = useSubmission(setScopeBookAction);
  // Show the new choice immediately while it is being saved.
  const current = () => (submission.pending ? submission.input?.[0] : scope()) ?? ALL;

  const onChange = (v: string | null) => {
    if (!v || v === current()) return;
    // On the lexicon page, restart paging and drop any explicit concordance filter so the new scope applies.
    if (location.pathname === "/") setSearch({ page: undefined, cp: undefined, book: undefined });
    void save(v === ALL ? null : v);
  };

  // Rendered once the stored value is known, and re-mounted when it changes: the Select then always
  // starts from the right value instead of relying on a controlled update across hydration.
  return (
    <Suspense fallback={<Placeholder />}>
      <Show when={scope() !== undefined && current()} keyed fallback={<Placeholder />}>
        {value => (
    <Select
      value={value}
      onChange={onChange}
      options={OPTIONS}
      itemComponent={p => <SelectItem item={p.item}>{label(p.item.rawValue)}</SelectItem>}
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
