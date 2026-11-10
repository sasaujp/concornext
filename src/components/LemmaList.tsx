import { A, createAsync, useSearchParams } from "@solidjs/router";
import { NotebookPen, Search, X } from "lucide-solid";
import { createSignal, For, onCleanup, Show, Suspense } from "solid-js";
import { Pagination, PaginationEllipsis, PaginationItem, PaginationItems, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Skeleton } from "~/components/ui/skeleton";
import { TextField, TextFieldInput } from "~/components/ui/text-field";
import { Toggle } from "~/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Badge } from "~/components/ui/badge";
import { GREEK_ALPHABET } from "~/lib/greek";
import { HEBREW_ALPHABET } from "~/lib/hebrew";
import { bookByCode, type Testament } from "~/lib/books";
import { scriptAttrs } from "~/lib/script";
import { lemmaListQuery, scopeBooksQuery } from "~/lib/queries";
import { cn } from "~/lib/utils";
import { defaultSort, type LexiconParams, lexiconHref, readParams } from "~/lib/url";

const MODE_LABEL = {
  all: "",
  strongs: "Strong's 番号で検索",
  greek: "ギリシャ語（アクセント無視・語形一致を含む）",
  hebrew: "ヘブライ語（母音記号・アクセント無視、接頭辞つきの語形一致を含む）",
  latin: "転写（見出し語・活用形）・英語の語義で検索",
} as const;

const PLACEHOLDER: Record<Testament, string> = {
  NT: "logos / egeneto / word / G3056 / メモ",
  OT: "bara / ברא / create / H1254 / メモ",
};

const HEBREW_LETTER_NAMES = ["alef", "bet", "gimel", "dalet", "he", "vav", "zayin", "chet", "tet", "yod", "kaf", "lamed", "mem", "nun", "samekh", "ayin", "pe", "tsadi", "qof", "resh", "shin", "tav"];

export function LemmaList() {
  const [search, setSearch] = useSearchParams<LexiconParams>();
  const params = () => readParams(search);
  const [draft, setDraft] = createSignal(params().q);
  // The 新約／旧約 switch (URL "t"); each testament has its own header book, which narrows the list.
  const scopes = createAsync(() => scopeBooksQuery());
  const testament = (): Testament => params().testament;
  const scopeBook = () => {
    const code = scopes()?.[testament()];
    return code ? bookByCode(code) : undefined;
  };
  // The header's book scope (D1) narrows the list; counts and frequency order are then within that book.
  // (All reactive reads happen before the await, see the note in LemmaPanel's Concordance.)
  const list = createAsync(async () => {
    const { q, sort, letter, memo, page, testament } = params();
    return lemmaListQuery(q, sort, letter, memo, (await scopeBooksQuery())[testament], page, testament);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const onInput = (v: string) => {
    setDraft(v);
    clearTimeout(timer);
    timer = setTimeout(() => setSearch({ q: v || undefined, page: undefined }, { replace: true }), 250);
  };

  const totalPages = () => Math.max(1, Math.ceil((list()?.total ?? 0) / (list()?.pageSize ?? 50)));

  return (
    <section class="flex h-full min-h-0 flex-col" aria-label="見出し語一覧">
      <div class="space-y-3 border-b p-3">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ToggleGroup
            size="sm"
            variant="outline"
            value={testament()}
            // Switching testaments clears the letter filter (Greek vs Hebrew letters) and paging.
            onChange={v => v && v !== params().testament && setSearch({ t: v === "OT" ? "ot" : undefined, l: undefined, page: undefined })}
            aria-label="新約・旧約"
          >
            <ToggleGroupItem value="NT" class="h-8 whitespace-nowrap px-3 text-xs data-[pressed]:bg-primary data-[pressed]:text-primary-foreground">
              新約（ギリシャ語）
            </ToggleGroupItem>
            <ToggleGroupItem value="OT" class="h-8 whitespace-nowrap px-3 text-xs data-[pressed]:bg-primary data-[pressed]:text-primary-foreground">
              旧約（ヘブライ語）
            </ToggleGroupItem>
          </ToggleGroup>
          <Show when={scopeBook()}>
            <span class="text-xs text-muted-foreground">ヘッダーで{scopeBook()!.ja}を選択中</span>
          </Show>
        </div>
        <TextField class="relative" value={draft()} onChange={onInput}>
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextFieldInput
            type="search"
            class="pl-9 pr-9"
            placeholder={PLACEHOLDER[testament()]}
            aria-label="見出し語を検索"
            autocomplete="off"
            spellcheck={false}
          />
          <Show when={draft()}>
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="検索をクリア"
              onClick={() => onInput("")}
            >
              <X class="size-4" />
            </button>
          </Show>
        </TextField>
        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ToggleGroup
            size="sm"
            variant="outline"
            value={params().sort}
            onChange={v => v && setSearch({ sort: v === defaultSort(params().memo) ? undefined : v, page: undefined })}
            aria-label="並び順"
          >
            <ToggleGroupItem value="alpha" class="h-8 px-2.5 text-xs">
              アルファベット順
            </ToggleGroupItem>
            <ToggleGroupItem value="freq" class="h-8 px-2.5 text-xs">
              出現頻度順
            </ToggleGroupItem>
            <Show when={params().memo}>
              <ToggleGroupItem value="memo" class="h-8 px-2.5 text-xs">
                メモ順
              </ToggleGroupItem>
            </Show>
          </ToggleGroup>
          <Toggle
            size="sm"
            variant="outline"
            pressed={params().memo}
            // Turning the memo filter on/off also resets the order to that mode's default (memo order / alphabetical).
            onChange={on => setSearch({ memo: on ? "1" : undefined, sort: undefined, page: undefined })}
            class="h-8 gap-1 px-2.5 text-xs data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
            aria-label="メモのある語だけ表示"
          >
            <NotebookPen class="size-3.5" aria-hidden="true" />
            メモあり
          </Toggle>
          <span class="flex-1" />
          <Suspense>
            <span aria-live="polite">{list()?.total.toLocaleString()} 語</span>
          </Suspense>
        </div>
        <Show
          when={testament() === "OT"}
          fallback={
            <ToggleGroup
              size="sm"
              value={params().letter}
              onChange={v => setSearch({ l: v ?? undefined, page: undefined })}
              class="grid grid-cols-12 gap-0.5"
              aria-label="頭文字で絞り込み（もう一度押すと解除）"
            >
              <For each={GREEK_ALPHABET}>
                {l => (
                  <ToggleGroupItem
                    value={l.key}
                    class="greek h-8 min-w-0 px-0 text-base leading-none data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
                    aria-label={`${l.upper} ${l.name}`}
                    title={l.name}
                  >
                    {l.upper}
                  </ToggleGroupItem>
                )}
              </For>
            </ToggleGroup>
          }
        >
          {/* Hebrew letters run right to left, like the alphabet itself (א at the right). */}
          <ToggleGroup
            size="sm"
            value={params().letter}
            onChange={v => setSearch({ l: v ?? undefined, page: undefined })}
            class="grid grid-cols-11 gap-0.5"
            dir="rtl"
            aria-label="頭文字で絞り込み（もう一度押すと解除）"
          >
            <For each={HEBREW_ALPHABET}>
              {(l, i) => (
                <ToggleGroupItem
                  value={l}
                  class="hebrew h-8 min-w-0 px-0 text-lg leading-none data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
                  aria-label={`${l} ${HEBREW_LETTER_NAMES[i()]}`}
                  title={HEBREW_LETTER_NAMES[i()]}
                  lang="he"
                >
                  {l}
                </ToggleGroupItem>
              )}
            </For>
          </ToggleGroup>
        </Show>
        <Suspense>
          <Show when={list()?.book}>
            {b => <p class="text-xs text-muted-foreground">{bookByCode(b())?.ja}に出てくる語（出現回数・頻度順は{bookByCode(b())?.ja}内）</p>}
          </Show>
          <Show when={list() && list()!.mode !== "all"}>
            <p class="text-xs text-muted-foreground">{MODE_LABEL[list()!.mode]}</p>
          </Show>
        </Suspense>
      </div>

      <div class="relative min-h-0 flex-1 overflow-y-auto">
        <Suspense fallback={<ListSkeleton />}>
          <Show
            when={list()?.items.length}
            fallback={
              <div class="p-8 text-center text-sm text-muted-foreground">
                {params().memo ? "メモのある見出し語はまだありません（条件に合うものがありません）。" : "該当する見出し語がありません。"}
                <br />
                {testament() === "OT"
                  ? "転写（bara）、ヘブライ文字（ברא・母音記号は不要）、英語の語義（create）、Strong's 番号（H1254）で検索できます。頭文字の絞り込みも確認してください。"
                  : "転写（logos・活用形 egeneto も可）、英語の語義（word）、Strong's 番号（G3056）で検索できます。頭文字の絞り込みも確認してください。"}
              </div>
            }
          >
            <ul class="divide-y">
              <For each={list()!.items}>
                {item => {
                  const selected = () => params().s === item.strongsId;
                  return (
                    <li>
                      <A
                        href={lexiconHref(params(), { s: item.strongsId, book: null, cp: 1 })}
                        class={cn(
                          "flex items-baseline gap-3 px-3 py-2 sm:px-4 sm:py-2.5 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                          selected() && "bg-accent",
                        )}
                        aria-current={selected() ? "true" : undefined}
                      >
                        <span {...scriptAttrs(item.lemma, "min-w-0 shrink-0 text-xl font-semibold leading-normal")}>{item.lemma}</span>
                        <span class="min-w-0 flex-1 text-sm">
                          <span class="block truncate">
                            <span class="text-muted-foreground">{item.transliteration}</span>
                            <Show when={item.altLemma}>
                              <span class="greek ml-1 text-muted-foreground" lang="grc">
                                ({item.altLemma})
                              </span>
                            </Show>
                            <Show when={item.language === "arc"}>
                              <Badge variant="secondary" class="ml-1.5 px-1.5 py-0 text-[10px] font-normal">
                                アラム語
                              </Badge>
                            </Show>
                            <Show when={item.glossJa ?? item.gloss}>
                              <span class="ml-2" title={item.gloss ?? undefined}>
                                {item.glossJa ?? item.gloss}
                              </span>
                            </Show>
                          </span>
                          <Show when={item.notes.length}>
                            <span class="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <NotebookPen class="size-3 shrink-0" aria-hidden="true" />
                              <span class="sr-only">メモ:</span>
                              <span class="truncate">
                                {/* Scoped to one book: just that book's memo; otherwise every book's, labelled. */}
                                {list()?.book
                                  ? item.notes[0].note
                                  : item.notes.map(n => `${bookByCode(n.book)?.ja ?? n.book}: ${n.note}`).join(" ／ ")}
                              </span>
                            </span>
                          </Show>
                        </span>
                        <span class="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          <span class="block font-medium text-foreground">{item.occurrenceCount.toLocaleString()}</span>
                          <span class="font-mono">{item.strongsId}</span>
                        </span>
                      </A>
                    </li>
                  );
                }}
              </For>
            </ul>
          </Show>
        </Suspense>
      </div>

      <Suspense>
        <Show when={totalPages() > 1}>
          <div class="flex justify-center border-t p-2">
            <Pagination
              count={totalPages()}
              page={params().page}
              onPageChange={p => setSearch({ page: p === 1 ? undefined : String(p) })}
              siblingCount={0}
              itemComponent={props => <PaginationItem page={props.page}>{props.page}</PaginationItem>}
              ellipsisComponent={() => <PaginationEllipsis />}
            >
              <PaginationPrevious />
              <PaginationItems />
              <PaginationNext />
            </Pagination>
          </div>
        </Show>
      </Suspense>
    </section>
  );
}

function ListSkeleton() {
  return (
    <div class="space-y-3 p-4" aria-busy="true">
      <For each={Array.from({ length: 12 })}>{() => <Skeleton class="h-8 w-full" />}</For>
    </div>
  );
}
