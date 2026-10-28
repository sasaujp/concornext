import { A, createAsync, useAction, useParams, useSearchParams, useSubmission } from "@solidjs/router";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-solid";
import { createMemo, For, Match, Show, Suspense, Switch } from "solid-js";
import { AnalysisView } from "~/components/AnalysisView";
import { GreekVerse } from "~/components/GreekVerse";
import { MorphBadges } from "~/components/MorphBadges";
import { plainSurface, WordDetails } from "~/components/WordDetails";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { bookByCode, displayRef, parseRef } from "~/lib/books";
import { decodeMorphology } from "~/lib/morph";
import { analyzeAction, appInfoQuery, bsbQuery, cachedAnalysisQuery, verseQuery, type AnalysisResponse } from "~/lib/queries";
import { lexiconHref, passageHref, readParams, safeReturnPath, verseHref } from "~/lib/url";

type VerseSearch = { s?: string; w?: string; from?: string };

export default function VersePage() {
  const params = useParams<{ ref: string }>();
  const [search, setSearch] = useSearchParams<VerseSearch>();
  const ref = createMemo(() => parseRef(params.ref));
  const verse = createAsync(async () => {
    const r = ref();
    return r ? verseQuery(r.book.code, r.chapter, r.verse) : null;
  });

  const strongs = () => (typeof search.s === "string" ? search.s : null);
  const highlight = () => verse()?.tokens.filter(t => t.parts.some(p => p.strongsId === strongs())).map(t => t.position) ?? [];
  /** Selected word: explicit ?w=, else first occurrence of the selected lemma, else first word. */
  const selectedPos = () => {
    const w = Number(search.w);
    const v = verse();
    if (!v) return null;
    if (w && v.tokens.some(t => t.position === w)) return w;
    return highlight()[0] ?? v.tokens[0]?.position ?? null;
  };
  const selected = () => verse()?.tokens.find(t => t.position === selectedPos()) ?? null;
  /** Lemma the analysis is about: the selected lemma if the word carries it, else the word's (first) lemma. */
  const targetStrongs = () => {
    const t = selected();
    if (!t) return null;
    return t.parts.find(p => p.strongsId === strongs())?.strongsId ?? t.parts[0].strongsId;
  };

  const from = () => safeReturnPath(typeof search.from === "string" ? search.from : null);
  const fromPassage = () => from()?.startsWith("/passage") ?? false;

  // Return to the concordance (or the passage reader) and scroll back to this verse.
  const backHref = () => {
    const base = from() ?? lexiconHref(readParams({ s: strongs() ?? undefined }));
    const r = ref();
    return r ? `${base.split("#")[0]}#v-${r.book.code}-${r.chapter}-${r.verse}` : base;
  };
  const navHref = (r: { book: string; chapter: number; verse: number }) => verseHref(r, { s: strongs(), from: typeof search.from === "string" ? search.from : null });

  const english = createAsync(async () => {
    const v = verse();
    return v ? bsbQuery([{ book: v.book, chapter: v.chapter, verse: v.verse }]) : null;
  });

  const aorists = () => verse()?.tokens.filter(t => t.parts.some(p => decodeMorphology(p.morphology).isAorist)) ?? [];

  return (
    <div class="mx-auto max-w-5xl space-y-4 px-3 py-4 sm:space-y-5 sm:p-4 lg:p-6">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <A href={backHref()} class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft class="size-4" aria-hidden="true" /> {fromPassage() ? "本文に戻る" : "コンコルダンスに戻る"}
          </A>
          <Show when={!fromPassage() && ref()}>
            {r => (
              <A
                href={passageHref(`${r().book.code}.${r().chapter}`, { at: selectedPos() ? `${r().chapter}.${r().verse}.${selectedPos()}` : null }) + `#v-${r().book.code}-${r().chapter}-${r().verse}`}
                class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <BookOpen class="size-4" aria-hidden="true" /> {r().book.ja} {r().chapter}章を本文で読む
              </A>
            )}
          </Show>
        </div>
        <Suspense>
          <Show when={verse()}>
            {v => (
              <nav class="flex items-center gap-1" aria-label="前後の節">
                <Show when={v().prev}>
                  {p => (
                    <Button as={A} href={navHref(p())} variant="ghost" size="sm">
                      <ChevronLeft class="size-4" aria-hidden="true" />
                      {displayRef(p().book, p().chapter, p().verse)}
                    </Button>
                  )}
                </Show>
                <Show when={v().next}>
                  {n => (
                    <Button as={A} href={navHref(n())} variant="ghost" size="sm">
                      {displayRef(n().book, n().chapter, n().verse)}
                      <ChevronRight class="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </Show>
              </nav>
            )}
          </Show>
        </Suspense>
      </div>

      <Show when={ref()} fallback={<Alert>節の指定が正しくありません（例: /verse/Jhn.1.6）。</Alert>}>
        {r => (
          <Suspense fallback={<Skeleton class="h-48 w-full" />}>
            <Show when={verse()} fallback={<Alert>{displayRef(r().book.code, r().chapter, r().verse)} のデータがありません。</Alert>}>
              {v => (
                <>
                  <Card>
                    <CardHeader class="pb-2">
                      <CardTitle class="text-xl">
                        {displayRef(v().book, v().chapter, v().verse)}
                        <span class="ml-2 text-sm font-normal text-muted-foreground">
                          {bookByCode(v().book)?.en} {v().chapter}:{v().verse}
                        </span>
                      </CardTitle>
                      <CardDescription>語をクリック（またはタップ）すると、その語の語形情報と解析対象が切り替わります。</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                      <GreekVerse
                        tokens={v().tokens}
                        highlight={highlight()}
                        selected={selectedPos() ?? undefined}
                        onSelect={pos => setSearch({ w: String(pos) }, { replace: true })}
                        size="lg"
                      />
                      <Suspense fallback={<Skeleton class="h-5 w-3/4" />}>
                        <p class="leading-relaxed text-muted-foreground">
                          <span class="mr-1.5 text-[11px] font-semibold tracking-wide">BSB</span>
                          {english()?.verses[`${v().book}.${v().chapter}.${v().verse}`] ?? "（英訳を取得できませんでした）"}
                        </p>
                      </Suspense>
                      <p class="text-xs text-muted-foreground">
                        本文は STEPBible TAGNT のうち NA28 に含まれる語から構成しています（語順・句読点は TAGNT による。NA28 で語順が異なる語には ↔ を付けています）。
                      </p>
                    </CardContent>
                  </Card>

                  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <Show when={selected()}>
                      {t => (
                        <Card>
                          <CardHeader class="pb-3">
                            <CardDescription>選択中の語（確定データ: STEPBible）</CardDescription>
                            <CardTitle class="greek text-3xl font-bold" lang="grc">
                              {plainSurface(t())}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <WordDetails token={t()} />
                          </CardContent>
                        </Card>
                      )}
                    </Show>
                    <Card>
                      <CardHeader class="pb-3">
                        <CardDescription>この節のアオリスト形（確定データ）</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Show when={aorists().length} fallback={<p class="text-sm">この節にはアオリスト形の語はありません。</p>}>
                          <ul class="space-y-2">
                            <For each={aorists()}>
                              {t => (
                                <li class="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    class="greek text-lg font-semibold hover:underline"
                                    lang="grc"
                                    onClick={() => setSearch({ w: String(t.position) }, { replace: true })}
                                  >
                                    {t.surface.replace(/[¶,.;·:]+/g, "")}
                                  </button>
                                  <span class="greek text-muted-foreground" lang="grc">
                                    ← {t.parts.map(p => p.lemma).join(" + ")}
                                  </span>
                                  <MorphBadges code={t.parts.find(p => decodeMorphology(p.morphology).isAorist)!.morphology} />
                                </li>
                              )}
                            </For>
                          </ul>
                        </Show>
                      </CardContent>
                    </Card>
                  </div>

                  <Show when={selectedPos() && targetStrongs()} keyed>
                    {_ => (
                      <AnalysisSection
                        book={v().book}
                        chapter={v().chapter}
                        verse={v().verse}
                        strongsId={targetStrongs()!}
                        position={selectedPos()!}
                        tokens={v().tokens}
                        english={() => english()?.verses[`${v().book}.${v().chapter}.${v().verse}`]}
                      />
                    )}
                  </Show>
                </>
              )}
            </Show>
          </Suspense>
        )}
      </Show>
    </div>
  );
}

function AnalysisSection(props: {
  book: string;
  chapter: number;
  verse: number;
  strongsId: string;
  position: number;
  tokens: import("~/lib/queries").Token[];
  english?: () => string | null | undefined;
}) {
  const req = () => ({ book: props.book, chapter: props.chapter, verse: props.verse, strongsId: props.strongsId, position: props.position });
  const reqKey = () => JSON.stringify(req());
  const info = createAsync(() => appInfoQuery());
  const cached = createAsync(() => cachedAnalysisQuery(req()));
  const analyze = useAction(analyzeAction);
  const submission = useSubmission(analyzeAction, input => JSON.stringify({ ...input[0], regenerate: undefined }) === reqKey());

  const result = (): AnalysisResponse | null | undefined => (submission.result as AnalysisResponse | undefined) ?? cached();
  const run = (regenerate: boolean) => analyze({ ...req(), regenerate: regenerate || undefined });
  const target = () => props.tokens.find(t => t.position === props.position);

  return (
    <Card aria-busy={submission.pending}>
      <CardHeader class="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div class="space-y-1">
          <CardTitle class="flex items-center gap-2 text-lg">
            <Sparkles class="size-5" aria-hidden="true" /> AI 文法解析
          </CardTitle>
          <CardDescription>
            対象:{" "}
            <span class="greek text-base text-foreground" lang="grc">
              {target()?.surface.replace(/[¶,.;·:]+/g, "")}
            </span>
            {" "}— 形態素は上の確定データを正とし、AI は構文・用法の説明のみを担当します。
          </CardDescription>
        </div>
        <Show when={result()?.status === "ok"}>
          <Button variant="outline" size="sm" disabled={submission.pending} onClick={() => run(true)}>
            <RefreshCw class={`size-4 ${submission.pending ? "animate-spin" : ""}`} aria-hidden="true" /> 再生成
          </Button>
        </Show>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton class="h-24 w-full" />}>
          <Switch>
            <Match when={submission.pending}>
              <div class="space-y-3" role="status">
                <p class="text-sm text-muted-foreground">Claude で解析しています…（数十秒かかることがあります）</p>
                <Skeleton class="h-6 w-2/3" />
                <Skeleton class="h-24 w-full" />
                <Skeleton class="h-24 w-full" />
              </div>
            </Match>
            <Match when={result()?.status === "no_api_key" || (!result() && info() && !info()!.hasApiKey)}>
              <NoApiKey />
            </Match>
            <Match when={result()?.status === "error" && (result() as Extract<AnalysisResponse, { status: "error" }>)}>
              {r => (
                <Alert variant="destructive">
                  <AlertTitle>解析に失敗しました</AlertTitle>
                  <AlertDescription class="space-y-3">
                    <p>{r().message}</p>
                    <Button variant="outline" size="sm" onClick={() => run(true)}>
                      再試行
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </Match>
            <Match when={result()?.status === "ok" && (result() as Extract<AnalysisResponse, { status: "ok" }>)}>
              {r => (
                <AnalysisView
                  result={r()}
                  tokens={props.tokens}
                  english={props.english}
                  reference={`${displayRef(props.book, props.chapter, props.verse)}（${bookByCode(props.book)?.en} ${props.chapter}:${props.verse}）`}
                />
              )}
            </Match>
            <Match when={true}>
              <div class="flex flex-col items-start gap-3">
                <p class="text-sm text-muted-foreground">
                  この節の構文、対象語の語形、アオリストの相と時間、逐語訳・自然訳を Claude Haiku が日本語で解説します。結果は保存され、次回からすぐに表示されます。
                </p>
                <Button onClick={() => run(false)}>
                  <Sparkles class="size-4" aria-hidden="true" /> 文法解析を生成
                </Button>
              </div>
            </Match>
          </Switch>
        </Suspense>
      </CardContent>
    </Card>
  );
}

function NoApiKey() {
  return (
    <Alert>
      <AlertTitle>Anthropic API キーが設定されていません</AlertTitle>
      <AlertDescription class="space-y-2 text-sm">
        <p>AI 文法解析を使うには API キーを設定してください。コンコルダンスと形態素データはキーなしで利用できます。</p>
        <p>
          ローカル開発: プロジェクト直下の <code class="rounded bg-muted px-1">.dev.vars</code> に{" "}
          <code class="rounded bg-muted px-1">ANTHROPIC_API_KEY=sk-ant-...</code> を書き、開発サーバーを再起動します。
        </p>
        <p>
          Workers: <code class="rounded bg-muted px-1">pnpm exec wrangler secret put ANTHROPIC_API_KEY</code>
        </p>
      </AlertDescription>
    </Alert>
  );
}
