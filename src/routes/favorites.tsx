import { A, createAsync, useLocation, useSearchParams } from "@solidjs/router";
import { BookOpen, Star } from "lucide-solid";
import { createEffect, For, Show, Suspense } from "solid-js";
import { FavoriteButton, FavoriteNote, useFavorites, verseKey } from "~/components/Favorite";
import { GreekVerse } from "~/components/GreekVerse";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { bookByCode, displayRef } from "~/lib/books";
import { scopeBookQuery, versesTokensQuery } from "~/lib/queries";
import { passageHref, verseHref } from "~/lib/url";

type FavoritesParams = { all?: string };

/** The user's favourite verses with their memos, in Bible order (limited to the header's book unless ?all=1). */
export default function FavoritesPage() {
  const location = useLocation();
  const [search] = useSearchParams<FavoritesParams>();
  const favs = useFavorites();
  const scope = createAsync(() => scopeBookQuery());
  const showAll = () => search.all === "1" || !scope();
  const shown = () => (favs.list() ?? []).filter(f => showAll() || f.book === scope());
  const hiddenCount = () => (favs.list()?.length ?? 0) - shown().length;

  // Greek text for the listed verses, loaded separately so the list (and memos) render first.
  const texts = createAsync(async () => {
    const refs = shown().map(f => ({ book: f.book, chapter: f.chapter, verse: f.verse }));
    if (!refs.length) return new Map<string, import("~/lib/queries").Token[]>();
    const verses = await versesTokensQuery(refs);
    return new Map(verses.map(v => [verseKey(v), v.tokens]));
  });

  const returnTo = () => `${location.pathname}${location.search}`;

  // Coming back from a verse page (#v-Book-C-V): scroll that verse into view once it is rendered.
  createEffect(() => {
    const id = location.hash.slice(1);
    if (!id || !favs.list()) return;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "center" }));
  });

  return (
    <div class="mx-auto max-w-4xl space-y-4 px-3 py-4 sm:p-4 lg:p-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <Star class="size-5 fill-amber-400 text-amber-500" aria-hidden="true" /> お気に入りの節
        </h1>
        <Suspense>
          <Show when={scope()}>
            {book => (
              <Show
                when={showAll()}
                fallback={
                  <A href="/favorites?all=1" class="text-sm text-muted-foreground hover:text-foreground hover:underline">
                    {bookByCode(book())?.ja}のみ表示中 — すべての書を表示{hiddenCount() ? `（ほか ${hiddenCount()} 節）` : ""}
                  </A>
                }
              >
                <A href="/favorites" class="text-sm text-muted-foreground hover:text-foreground hover:underline">
                  {bookByCode(book())?.ja}だけを表示
                </A>
              </Show>
            )}
          </Show>
        </Suspense>
      </div>

      <Suspense fallback={<Skeleton class="h-48 w-full" />}>
        <Show
          when={shown().length}
          fallback={
            <Alert>
              <Show when={favs.list()?.length} fallback="まだお気に入りの節はありません。">
                この書にはお気に入りの節がありません。
              </Show>
              本文・コンコルダンス・解析ページで節の横の ☆ を押すと追加できます。
            </Alert>
          }
        >
          <p class="text-sm text-muted-foreground">{shown().length} 節</p>
          <ol class="space-y-3">
            <For each={shown()}>
              {f => (
                <li id={`v-${f.book}-${f.chapter}-${f.verse}`} class="scroll-mt-20">
                  <Card>
                    <CardHeader class="flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-3 pb-1 sm:p-4 sm:pb-2">
                      <span class="flex items-center gap-1">
                        <FavoriteButton book={f.book} chapter={f.chapter} verse={f.verse} class="-ml-1" />
                        <A href={verseHref(f, { from: returnTo() })} class="text-sm font-semibold hover:underline">
                          {displayRef(f.book, f.chapter, f.verse)}
                        </A>
                      </span>
                      <Button
                        as={A}
                        href={`${passageHref(`${f.book}.${f.chapter}`)}#v-${f.book}-${f.chapter}-${f.verse}`}
                        variant="ghost"
                        size="sm"
                        class="h-8"
                      >
                        <BookOpen class="size-4" aria-hidden="true" /> {f.chapter}章を本文で読む
                      </Button>
                    </CardHeader>
                    <CardContent class="space-y-3 p-3 pt-0 sm:p-4 sm:pt-0">
                      <Suspense fallback={<Skeleton class="h-8 w-full" />}>
                        <Show when={texts()?.get(verseKey(f))}>{tokens => <GreekVerse tokens={tokens()} />}</Show>
                      </Suspense>
                      <FavoriteNote book={f.book} chapter={f.chapter} verse={f.verse} />
                    </CardContent>
                  </Card>
                </li>
              )}
            </For>
          </ol>
        </Show>
      </Suspense>
    </div>
  );
}
