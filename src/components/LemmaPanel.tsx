import { A, createAsync, useLocation, useSearchParams } from "@solidjs/router";
import { ArrowLeft, ExternalLink, GraduationCap } from "lucide-solid";
import { createEffect, For, Show, Suspense } from "solid-js";
import { GreekVerse, hitMarker } from "~/components/GreekVerse";
import { MorphBadges } from "~/components/MorphBadges";
import { NoteEditor } from "~/components/NoteEditor";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Pagination, PaginationEllipsis, PaginationItem, PaginationItems, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { displayRef } from "~/lib/books";
import { bsbQuery, concordanceQuery, lemmaDetailQuery, scopeBookQuery, type ConcordancePage, type LemmaDetail } from "~/lib/queries";
import { type LexiconParams, lexiconHref, readParams, verseHref } from "~/lib/url";

const ALL_BOOKS = "all";

export function LemmaPanel(props: { strongsId: string }) {
  const [search] = useSearchParams<LexiconParams>();
  const params = () => readParams(search);
  const detail = createAsync(() => lemmaDetailQuery(props.strongsId));

  return (
    <div class="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:space-y-6 sm:p-4 lg:p-6">
      <A href={lexiconHref(params(), { s: null, book: null, cp: 1 })} class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground lg:hidden">
        <ArrowLeft class="size-4" /> 一覧に戻る
      </A>
      <Suspense fallback={<HeaderSkeleton />}>
        <Show when={detail()} fallback={<Alert>見出し語 {props.strongsId} は見つかりませんでした。</Alert>}>
          {d => <LemmaHeader lemma={d()} />}
        </Show>
      </Suspense>
      <Suspense fallback={<ConcordanceSkeleton />}>
        <Show when={detail()}>{d => <Concordance lemma={d()} />}</Show>
      </Suspense>
    </div>
  );
}

function LemmaHeader(props: { lemma: LemmaDetail }) {
  const num = () => Number(props.lemma.strongsBase.slice(1));
  return (
    <header class="space-y-3">
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 class="greek text-4xl font-bold leading-tight sm:text-5xl" lang="grc">
          {props.lemma.greekLemma}
        </h1>
        <span class="text-lg text-muted-foreground">{props.lemma.transliteration}</span>
        <Show when={props.lemma.altLemma}>
          <span class="text-sm text-muted-foreground">
            TAGNT の辞書形:{" "}
            <span class="greek text-lg text-foreground" lang="grc">
              {props.lemma.altLemma}
            </span>
          </span>
        </Show>
      </div>
      <p class="text-lg">
        {props.lemma.glossJa ?? props.lemma.gloss}
        <Show when={props.lemma.glossJa && props.lemma.gloss}>
          <span class="ml-2 text-sm text-muted-foreground" lang="en">
            {props.lemma.gloss}
          </span>
        </Show>
      </p>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" class="font-mono">
          {props.lemma.strongsId}
        </Badge>
        <Show when={props.lemma.lexPos}>
          <Badge variant="secondary" class="font-mono font-normal">
            {props.lemma.lexPos}
          </Badge>
        </Show>
        <span class="text-muted-foreground">
          出現 <strong class="text-foreground tabular-nums">{props.lemma.occurrenceCount.toLocaleString()}</strong> 回 ／{" "}
          <strong class="text-foreground tabular-nums">{props.lemma.verseCount.toLocaleString()}</strong> 節
        </span>
        <Button
          as="a"
          href={`https://biblehub.com/greek/${num()}.htm`}
          target="_blank"
          rel="noopener noreferrer"
          variant="link"
          size="sm"
          class="h-auto px-1"
        >
          BibleHub <ExternalLink class="size-3.5" aria-hidden="true" />
          <span class="sr-only">（新しいタブで開く）</span>
        </Button>
      </div>
      <NoteEditor strongsId={props.lemma.strongsId} notes={props.lemma.notes} />
      <Show when={props.lemma.definitionHtml}>
        <details class="rounded-md border bg-muted/40 p-3 text-sm">
          <summary class="cursor-pointer select-none font-medium">辞書（TBESG / Abbott-Smith）</summary>
          {/* TBESG lexicon HTML from STEPBible (trusted static data); <ref> tags render as plain text. */}
          <div class="lexicon mt-2 leading-relaxed [&_b]:font-semibold" innerHTML={props.lemma.definitionHtml!} />
        </details>
      </Show>
    </header>
  );
}

function Concordance(props: { lemma: LemmaDetail }) {
  const [search, setSearch] = useSearchParams<LexiconParams>();
  const location = useLocation();
  const params = () => readParams(search);
  const scope = createAsync(() => scopeBookQuery());
  /**
   * Concordance filter: an explicit ?book= wins ("all" = every book); otherwise the header's book,
   * if this lemma occurs there.
   *
   * Everything reactive (props.lemma comes from a <Show> accessor) is read *before* the first await:
   * reading it afterwards throws "Stale read from <Show>" if the panel closed in the meantime
   * (e.g. going back to the list on a slow phone while the scope was still loading).
   */
  const concordanceArgs = async () => {
    const strongsId = props.lemma.strongsId;
    const books = props.lemma.books.map(x => x.code);
    const explicit = params().book;
    const cp = params().cp;
    let book: string | null;
    if (explicit === ALL_BOOKS) book = null;
    else if (explicit) book = explicit;
    else {
      const s = await scopeBookQuery();
      book = s && books.includes(s) ? s : null;
    }
    return [strongsId, book, cp] as const;
  };
  const page = createAsync(async () => concordanceQuery(...(await concordanceArgs())));
  // English is loaded as a separate resource (chained on the concordance page) and read only inside
  // its own Suspense boundaries, so the Greek renders even if the BSB API is slow or down.
  const bsb = createAsync(async () => {
    const p = await concordanceQuery(...(await concordanceArgs()));
    const refs = p?.verses.map(v => ({ book: v.book, chapter: v.chapter, verse: v.verse })) ?? [];
    return refs.length ? bsbQuery(refs) : null;
  });
  const totalPages = () => Math.max(1, Math.ceil((page()?.totalVerses ?? 0) / (page()?.pageSize ?? 20)));
  const bookOptions = () => [ALL_BOOKS, ...props.lemma.books.map(b => b.code)];
  const bookLabel = (code: string | undefined) => {
    if (!code || code === ALL_BOOKS) return `すべての書（${props.lemma.books.length}書）`;
    const b = props.lemma.books.find(x => x.code === code);
    return b ? `${b.ja}（${b.occurrences}回／${b.verses}節）` : code;
  };
  const returnTo = () => `${location.pathname}${location.search}`;

  // Coming back from a verse page (#v-Book-C-V): scroll that verse into view once it is rendered.
  createEffect(() => {
    const id = location.hash.slice(1);
    if (!id || !page()) return;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  });

  return (
    <section class="space-y-4" aria-label="コンコルダンス">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-base font-semibold">コンコルダンス（聖書順）</h2>
        <Select
          value={page()?.book ?? ALL_BOOKS}
          onChange={v => {
            // Kobalte also reports programmatic value changes (e.g. when the header scope applies); ignore those.
            if (!v || v === (page()?.book ?? ALL_BOOKS)) return;
            setSearch({ book: v === ALL_BOOKS ? (scope() ? ALL_BOOKS : undefined) : v, cp: undefined });
          }}
          options={bookOptions()}
          itemComponent={p => <SelectItem item={p.item}>{bookLabel(p.item.rawValue)}</SelectItem>}
          aria-label="書巻で絞り込み"
        >
          <SelectTrigger class="w-60">
            <SelectValue<string>>{state => bookLabel(state.selectedOption())}</SelectValue>
          </SelectTrigger>
          <SelectContent class="max-h-80 overflow-y-auto" />
        </Select>
      </div>

      <Show when={page()}>
        {p => (
          <>
            <p class="text-sm text-muted-foreground" aria-live="polite">
              {p().book ? `${props.lemma.books.find(b => b.code === p().book)?.ja ?? p().book}: ` : ""}
              {p().totalOccurrences.toLocaleString()} 回 ／ {p().totalVerses.toLocaleString()} 節 — {(p().page - 1) * p().pageSize + 1}〜
              {Math.min(p().page * p().pageSize, p().totalVerses)} 節目を表示
            </p>
            <Suspense>
              <Show when={bsb()?.error}>
                <Alert variant="default" class="text-sm">
                  <AlertDescription>BSB 英訳の一部を取得できませんでした（ギリシャ語データは表示しています）。{bsb()!.error}</AlertDescription>
                </Alert>
              </Show>
            </Suspense>
            <ol class="space-y-3">
              <For each={p().verses}>
                {v => <ConcordanceVerse verse={v} lemma={props.lemma} english={() => bsb()?.verses[`${v.book}.${v.chapter}.${v.verse}`]} returnTo={returnTo()} />}
              </For>
            </ol>
            <Show when={totalPages() > 1}>
              <div class="flex justify-center pt-2">
                <Pagination
                  count={totalPages()}
                  page={p().page}
                  onPageChange={n => {
                    setSearch({ cp: n === 1 ? undefined : String(n) });
                    document.getElementById("detail-scroll")?.scrollTo({ top: 0 });
                  }}
                  itemComponent={ip => <PaginationItem page={ip.page}>{ip.page}</PaginationItem>}
                  ellipsisComponent={() => <PaginationEllipsis />}
                >
                  <PaginationPrevious />
                  <PaginationItems />
                  <PaginationNext />
                </Pagination>
              </div>
            </Show>
          </>
        )}
      </Show>
    </section>
  );
}

function ConcordanceVerse(props: {
  verse: ConcordancePage["verses"][number];
  lemma: LemmaDetail;
  /** Reading this may suspend (BSB still loading). */
  english: () => string | null | undefined;
  returnTo: string;
}) {
  const hitTokens = () => props.verse.tokens.filter(t => props.verse.hits.includes(t.position));
  return (
    <li id={`v-${props.verse.book}-${props.verse.chapter}-${props.verse.verse}`}>
      <Card>
        <CardHeader class="flex-row items-center justify-between gap-2 space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
          <A
            href={verseHref(props.verse, { s: props.lemma.strongsId, w: props.verse.hits[0], from: props.returnTo })}
            class="text-sm font-semibold hover:underline"
          >
            {displayRef(props.verse.book, props.verse.chapter, props.verse.verse)}
          </A>
          <Show when={props.verse.hits.length > 1}>
            <Badge variant="secondary" class="font-normal">
              この節に {props.verse.hits.length} 回
            </Badge>
          </Show>
        </CardHeader>
        <CardContent class="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
          <GreekVerse tokens={props.verse.tokens} highlight={props.verse.hits} />
          <Suspense fallback={<Skeleton class="h-5 w-4/5" />}>
            <p class="text-sm leading-relaxed text-muted-foreground">
              <span class="mr-1.5 text-[11px] font-semibold tracking-wide">BSB</span>
              {props.english() ?? "（英訳を取得できませんでした）"}
            </p>
          </Suspense>
          <Separator />
          <ul class="space-y-2">
            <For each={hitTokens()}>
              {(t, i) => {
                const part = () => t.parts.find(p => p.lemmaId === props.lemma.id) ?? t.parts[0];
                return (
                  <li class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span class="greek text-lg font-semibold leading-normal" lang="grc">
                      <Show when={props.verse.hits.length > 1}>
                        <span class="mr-1 font-sans text-sm">{hitMarker(i())}</span>
                      </Show>
                      {t.surface.replace(/[¶,.;·:]+/g, "")}
                    </span>
                    <MorphBadges code={part().morphology} />
                    <Show when={t.parts.length > 1}>
                      <Badge variant="outline" class="font-normal">
                        融合形（{t.parts.map(p => p.lemma).join(" + ")}）
                      </Badge>
                    </Show>
                    <Button
                      as={A}
                      href={verseHref(props.verse, { s: props.lemma.strongsId, w: t.position, from: props.returnTo })}
                      variant="outline"
                      size="sm"
                      class="ml-auto h-8"
                    >
                      <GraduationCap class="size-4" aria-hidden="true" />
                      文法解析
                    </Button>
                  </li>
                );
              }}
            </For>
          </ul>
        </CardContent>
      </Card>
    </li>
  );
}

function HeaderSkeleton() {
  return (
    <div class="space-y-3">
      <Skeleton class="h-12 w-48" />
      <Skeleton class="h-6 w-64" />
      <Skeleton class="h-6 w-80" />
    </div>
  );
}

function ConcordanceSkeleton() {
  return (
    <div class="space-y-3">
      <For each={[1, 2, 3]}>{() => <Skeleton class="h-40 w-full" />}</For>
    </div>
  );
}
