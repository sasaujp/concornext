import { A, createAsync, useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { ChevronLeft, ChevronRight, GraduationCap, Library, NotebookPen, X } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, on, Show, Suspense } from "solid-js";
import { FavoriteButton, useFavorites } from "~/components/Favorite";
import { GreekVerse } from "~/components/GreekVerse";
import { plainSurface, WordDetails } from "~/components/WordDetails";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { BOOKS, bookByCode, CHAPTER_END, displayPassage, formatPassage, parsePassage, type Passage } from "~/lib/books";
import { bsbQuery, outlineQuery, passageQuery, scopeBookQuery, type Token, type VerseTokens } from "~/lib/queries";
import { lexiconHref, type PassageParams, passageHref, readParams, verseHref } from "~/lib/url";

const EXAMPLES = ["Jhn.1.1-18", "Mat.5.1-12", "Rom.8", "1Co.13", "Php.2.5-11", "Heb.1.1-4"];

type Selected = { verse: VerseTokens; token: Token };

export default function PassagePage() {
  const [search] = useSearchParams<PassageParams>();
  const raw = () => (typeof search.r === "string" ? search.r : "");
  const passage = createMemo(() => (raw() ? parsePassage(raw()) : null));

  return (
    <div class="mx-auto max-w-[1400px] space-y-4 px-3 py-4 sm:p-4 lg:p-6">
      <PassagePicker passage={passage()} raw={raw()} />
      <Show
        when={passage()}
        keyed
        fallback={
          <Show when={raw()} fallback={<Intro />}>
            <Alert>「{raw()}」を範囲として読み取れませんでした。例: ヨハネ 1:1-18、John 3、Rom 8:28-39</Alert>
          </Show>
        }
      >
        {p => <PassageReader passage={p} />}
      </Show>
    </div>
  );
}

const fieldClass =
  "h-10 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Book / chapter / verse dropdowns (native selects, so phones get their own picker), plus a free-text
 * field for anything else (e.g. ranges across chapters). Starts from the passage being shown, else the header's book.
 */
function PassagePicker(props: { passage: Passage | null; raw: string }) {
  const navigate = useNavigate();
  const outline = createAsync(() => outlineQuery());
  const scope = createAsync(() => scopeBookQuery());

  // User choices; undefined = follow the passage on screen. Reset whenever that passage changes.
  const [book, setBook] = createSignal<string>();
  const [chapter, setChapter] = createSignal<number>();
  const [from, setFrom] = createSignal<number>();
  const [to, setTo] = createSignal<number>();
  createEffect(
    on(
      () => props.passage,
      () => {
        setBook(undefined);
        setChapter(undefined);
        setFrom(undefined);
        setTo(undefined);
      },
    ),
  );

  const p = () => props.passage;
  const singleChapter = () => !!p() && p()!.from.chapter === p()!.to.chapter;
  const curBook = () => book() ?? p()?.book.code ?? scope() ?? "Mat";
  const chapters = () => outline()?.[curBook()] ?? [];
  const curChapter = () => Math.min(chapter() ?? p()?.from.chapter ?? 1, Math.max(chapters().length, 1));
  const verseCount = () => chapters()[curChapter() - 1] ?? 0;
  const curFrom = () => from() ?? (singleChapter() && book() === undefined && chapter() === undefined ? p()!.from.verse : 1);
  const curTo = () => {
    const v = to() ?? (singleChapter() && book() === undefined && chapter() === undefined ? p()!.to.verse : CHAPTER_END);
    return v < curFrom() ? curFrom() : v;
  };
  const range = (a: number, b: number) => Array.from({ length: Math.max(b - a + 1, 0) }, (_, i) => a + i);

  const show = () => {
    const target = bookByCode(curBook());
    if (!target) return;
    const passage: Passage = {
      book: target,
      from: { chapter: curChapter(), verse: curFrom() },
      to: { chapter: curChapter(), verse: curTo() >= verseCount() ? CHAPTER_END : curTo() },
    };
    navigate(passageHref(formatPassage(passage)));
  };

  const [error, setError] = createSignal(false);
  const onSubmitText = (e: SubmitEvent) => {
    e.preventDefault();
    const value = new FormData(e.currentTarget as HTMLFormElement).get("r")?.toString() ?? "";
    const parsed = parsePassage(value);
    setError(!parsed);
    if (parsed) navigate(passageHref(formatPassage(parsed)));
  };

  return (
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
        <select
          class={fieldClass}
          aria-label="書"
          onChange={e => {
            setBook(e.currentTarget.value);
            setChapter(1);
            setFrom(undefined);
            setTo(undefined);
          }}
        >
          <For each={BOOKS}>
            {b => (
              <option value={b.code} selected={b.code === curBook()}>
                {b.ja}
              </option>
            )}
          </For>
        </select>
        <span class="inline-flex items-center gap-1 text-sm">
          <select
            class={fieldClass}
            aria-label="章"
            disabled={!chapters().length}
            onChange={e => {
              setChapter(Number(e.currentTarget.value));
              setFrom(undefined);
              setTo(undefined);
            }}
          >
            <For each={range(1, chapters().length)}>
              {c => (
                <option value={c} selected={c === curChapter()}>
                  {c}
                </option>
              )}
            </For>
          </select>
          章
        </span>
        <span class="inline-flex items-center gap-1 text-sm">
          <select class={fieldClass} aria-label="開始節" disabled={!verseCount()} onChange={e => setFrom(Number(e.currentTarget.value))}>
            <For each={range(1, verseCount())}>
              {v => (
                <option value={v} selected={v === curFrom()}>
                  {v}
                </option>
              )}
            </For>
          </select>
          〜
          <select class={fieldClass} aria-label="終了節" disabled={!verseCount()} onChange={e => setTo(Number(e.currentTarget.value))}>
            <For each={range(curFrom(), verseCount() - 1)}>
              {v => (
                <option value={v} selected={v === curTo()}>
                  {v}
                </option>
              )}
            </For>
            <option value={CHAPTER_END} selected={curTo() >= verseCount()}>
              {verseCount()}（章末）
            </option>
          </select>
          節
        </span>
        <Button onClick={show} disabled={!verseCount()}>
          本文を表示
        </Button>
      </div>
      <details class="text-sm" open={!!props.raw && !props.passage}>
        <summary class="cursor-pointer text-muted-foreground">直接入力（章をまたぐ範囲など）</summary>
        {/* Plain GET form: works before hydration too (the page parses any accepted spelling of `r`). */}
        <form method="get" action="/passage" onSubmit={onSubmitText} class="mt-2 flex flex-wrap items-center gap-2">
          <input
            name="r"
            value={props.passage ? displayPassage(props.passage) : props.raw}
            placeholder="例: ヨハネ 1:1-2:11、Mat 5-7"
            autocomplete="off"
            aria-label="範囲を入力"
            aria-invalid={error()}
            class={`${fieldClass} w-64 px-3 placeholder:text-muted-foreground`}
          />
          <Button type="submit" variant="outline">
            表示
          </Button>
          <Show when={error()}>
            <span class="text-destructive" role="alert">
              範囲を読み取れませんでした
            </span>
          </Show>
        </form>
      </details>
    </div>
  );
}

function Intro() {
  return (
    <Card class="max-w-2xl">
      <CardHeader>
        <CardTitle>章・節の範囲から本文を読む</CardTitle>
        <CardDescription>
          書名と章・節を入力すると、その範囲のギリシャ語本文を表示します。語をクリック（またはタップ）すると語形と辞書形が表示され、そこからコンコルダンスや文法解析に進めます。
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3 text-sm">
        <p class="text-muted-foreground">
          上で書・章・節を選んで「本文を表示」を押してください。章をまたぐ範囲は「直接入力」で <code>ヨハネ 1:1-2:11</code>、<code>Mat 5-7</code> のように書けます。一度に表示するのは最大 200 節です。
        </p>
        <ul class="flex flex-wrap gap-2">
          <For each={EXAMPLES}>
            {r => (
              <li>
                <Button as={A} href={passageHref(r)} variant="outline" size="sm">
                  {displayPassage(parsePassage(r)!)}
                </Button>
              </li>
            )}
          </For>
        </ul>
      </CardContent>
    </Card>
  );
}

function PassageReader(props: { passage: Passage }) {
  const location = useLocation();
  const [search, setSearch] = useSearchParams<PassageParams>();
  // Read everything from props before the first await (see LemmaPanel's note on stale reads).
  const args = () => [props.passage.book.code, props.passage.from, props.passage.to] as const;
  const data = createAsync(() => passageQuery(...args()));
  const showEnglish = () => search.en !== "0";
  // English is a separate resource read in its own Suspense, so the Greek never waits on the BSB API.
  const bsb = createAsync(async () => {
    if (!showEnglish()) return null;
    const d = await passageQuery(...args());
    const refs = d?.verses.map(v => ({ book: v.book, chapter: v.chapter, verse: v.verse })) ?? [];
    return refs.length ? bsbQuery(refs) : null;
  });

  const favs = useFavorites();

  const selected = createMemo((): Selected | null => {
    const at = typeof search.at === "string" ? search.at.split(".").map(Number) : [];
    if (at.length !== 3) return null;
    const verse = data()?.verses.find(v => v.chapter === at[0] && v.verse === at[1]);
    const token = verse?.tokens.find(t => t.position === at[2]);
    return verse && token ? { verse, token } : null;
  });
  const select = (v: VerseTokens, position: number) => setSearch({ at: `${v.chapter}.${v.verse}.${position}` }, { replace: true });
  const clear = () => setSearch({ at: undefined }, { replace: true });

  /** Every occurrence, within the passage, of the selected word's lemma(s): "chapter.verse" → positions. */
  const sameLemma = createMemo(() => {
    const sel = selected();
    const out = new Map<string, number[]>();
    if (!sel) return out;
    const ids = new Set(sel.token.parts.map(p => p.strongsId));
    for (const v of data()?.verses ?? []) {
      const hits = v.tokens.filter(t => t.parts.some(p => ids.has(p.strongsId))).map(t => t.position);
      if (hits.length) out.set(`${v.chapter}.${v.verse}`, hits);
    }
    return out;
  });
  const sameLemmaCount = () => [...sameLemma().values()].reduce((n, hits) => n + hits.length, 0);

  const returnTo = () => `${location.pathname}${location.search}`;
  const chapterHref = (chapter: number) => passageHref(`${props.passage.book.code}.${chapter}`, { en: showEnglish() });
  const isFirstOfChapter = (i: number) => {
    const vs = data()?.verses ?? [];
    return i === 0 || vs[i - 1].chapter !== vs[i].chapter;
  };

  // Coming back from a verse page (#v-Book-C-V): scroll that verse into view once it is rendered.
  createEffect(() => {
    const id = location.hash.slice(1);
    if (!id || !data()) return;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
  });

  return (
    <Suspense fallback={<Skeleton class="h-96 w-full" />}>
      <Show when={data()}>
        {d => (
          <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <section class={selected() ? "pb-[50dvh] lg:pb-0" : ""} aria-label="本文">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h1 class="text-xl font-semibold">
                  {displayPassage(props.passage)}
                  <span class="ml-2 text-sm font-normal text-muted-foreground">{props.passage.book.en}</span>
                </h1>
                <div class="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setSearch({ en: showEnglish() ? "0" : undefined }, { replace: true })}>
                    {showEnglish() ? "英訳を隠す" : "英訳を表示"}
                  </Button>
                  <Show when={props.passage.from.chapter > 1}>
                    <Button as={A} href={chapterHref(props.passage.from.chapter - 1)} variant="ghost" size="sm">
                      <ChevronLeft class="size-4" aria-hidden="true" />
                      {props.passage.from.chapter - 1}章
                    </Button>
                  </Show>
                  <Show when={props.passage.to.chapter < d().lastChapter}>
                    <Button as={A} href={chapterHref(props.passage.to.chapter + 1)} variant="ghost" size="sm">
                      {props.passage.to.chapter + 1}章
                      <ChevronRight class="size-4" aria-hidden="true" />
                    </Button>
                  </Show>
                </div>
              </div>

              <Show when={d().truncated}>
                <Alert class="mb-3 text-sm">
                  <AlertDescription>範囲が長いため、最初の 200 節だけを表示しています。</AlertDescription>
                </Alert>
              </Show>
              <Suspense>
                <Show when={bsb()?.error}>
                  <Alert class="mb-3 text-sm">
                    <AlertDescription>BSB 英訳の一部を取得できませんでした（ギリシャ語は表示しています）。{bsb()!.error}</AlertDescription>
                  </Alert>
                </Show>
              </Suspense>

              <Show when={d().verses.length} fallback={<Alert>{displayPassage(props.passage)} の本文データがありません。</Alert>}>
                <ol class="space-y-3">
                  <For each={d().verses}>
                    {(v, i) => (
                      <li id={`v-${v.book}-${v.chapter}-${v.verse}`} class="scroll-mt-20">
                        <Show when={isFirstOfChapter(i()) && (props.passage.from.chapter !== props.passage.to.chapter || props.passage.to.verse === CHAPTER_END)}>
                          <h2 class="mb-2 mt-4 border-b pb-1 text-sm font-semibold text-muted-foreground first:mt-0">{v.chapter}章</h2>
                        </Show>
                        <div class="flex gap-2">
                          <div class="flex w-9 shrink-0 flex-col items-end pt-1.5">
                            <span class="text-xs font-semibold tabular-nums text-muted-foreground">
                              {v.chapter}:{v.verse}
                            </span>
                            <FavoriteButton book={v.book} chapter={v.chapter} verse={v.verse} class="-mr-1" confirmBelow />
                          </div>
                          <div class="min-w-0 flex-1 space-y-1">
                            <GreekVerse
                              tokens={v.tokens}
                              highlight={sameLemma().get(`${v.chapter}.${v.verse}`) ?? []}
                              selected={selected()?.verse === v ? selected()!.token.position : undefined}
                              onSelect={pos => select(v, pos)}
                            />
                            <Show when={favs.get(v)?.note}>
                              {note => (
                                <p class="flex items-start gap-1.5 text-sm">
                                  <NotebookPen class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                  {/* Long memos are clamped here; the full text is on the verse page and the favourites list. */}
                                  <span class="line-clamp-3 whitespace-pre-wrap break-words" title={note()}>
                                    {note()}
                                  </span>
                                </p>
                              )}
                            </Show>
                            <Show when={showEnglish()}>
                              <Suspense>
                                <Show when={bsb()?.verses[`${v.book}.${v.chapter}.${v.verse}`]}>
                                  {text => <p class="text-sm leading-relaxed text-muted-foreground">{text()}</p>}
                                </Show>
                              </Suspense>
                            </Show>
                          </div>
                        </div>
                      </li>
                    )}
                  </For>
                </ol>
              </Show>
              <p class="mt-4 text-xs text-muted-foreground">
                本文は STEPBible TAGNT のうち NA28 に含まれる語から構成しています（語順・句読点は TAGNT による。NA28 で語順が異なる語には ↔ を付けています）。
              </p>
            </section>

            <aside
              class={
                selected()
                  ? "fixed inset-x-0 bottom-0 z-20 max-h-[45dvh] overflow-y-auto rounded-t-xl border-t bg-background shadow-lg lg:sticky lg:top-[4.5rem] lg:z-auto lg:max-h-[calc(100dvh-5.5rem)] lg:self-start lg:rounded-none lg:border-t-0 lg:shadow-none"
                  : "hidden lg:sticky lg:top-[4.5rem] lg:block lg:self-start"
              }
              aria-label="選択中の語"
            >
              <Show
                when={selected()}
                fallback={<p class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">本文の語をクリックすると、ここに語形と辞書形が表示されます。</p>}
              >
                {sel => (
                  <Card class="rounded-none border-0 lg:rounded-lg lg:border">
                    <CardHeader class="flex-row items-start justify-between gap-2 space-y-0 pb-3">
                      <div class="space-y-1">
                        <CardDescription>
                          {props.passage.book.ja} {sel().verse.chapter}:{sel().verse.verse}
                          <Show when={sameLemmaCount() > 1}>（この範囲に {sameLemmaCount()} 回）</Show>
                        </CardDescription>
                        <CardTitle class="greek text-3xl font-bold" lang="grc">
                          {plainSurface(sel().token)}
                        </CardTitle>
                      </div>
                      <Button variant="ghost" size="icon" class="-mr-2 -mt-2 size-8" onClick={clear} aria-label="閉じる">
                        <X class="size-4" aria-hidden="true" />
                      </Button>
                    </CardHeader>
                    <CardContent class="space-y-4">
                      <WordDetails token={sel().token} />
                      <div class="flex flex-wrap gap-2">
                        <Button
                          as={A}
                          href={verseHref(sel().verse, { s: sel().token.parts[0].strongsId, w: sel().token.position, from: returnTo() })}
                          size="sm"
                        >
                          <GraduationCap class="size-4" aria-hidden="true" /> この節を解析
                        </Button>
                        <For each={sel().token.parts}>
                          {p => (
                            <Button as={A} href={lexiconHref(readParams({ s: p.strongsId }))} variant="outline" size="sm">
                              <Library class="size-4" aria-hidden="true" />
                              <span class="greek" lang="grc">
                                {p.lemma}
                              </span>
                              のコンコルダンス
                            </Button>
                          )}
                        </For>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </Show>
            </aside>
          </div>
        )}
      </Show>
    </Suspense>
  );
}
