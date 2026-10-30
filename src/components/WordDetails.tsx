import { A, createAsync } from "@solidjs/router";
import { Library } from "lucide-solid";
import { For, Show, Suspense } from "solid-js";
import { na28Shift } from "~/components/GreekVerse";
import { MorphBadges } from "~/components/MorphBadges";
import { NoteEditor } from "~/components/NoteEditor";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { lemmaDetailQuery, type Token } from "~/lib/queries";
import { lexiconHref, readParams } from "~/lib/url";

export const plainSurface = (t: Token) => t.surface.replace(/[¶,.;·:]+/g, "");

/**
 * Confirmed (STEPBible) data for one word: lemma(s) with gloss, morphology and the user's memo, then transliteration etc.
 * With `onLemma`, a lemma opens its concordance in place (ConcordanceDialog) instead of linking to the lexicon.
 */
export function WordDetails(props: { token: Token; onLemma?: (strongsId: string) => void }) {
  return (
    <div class="space-y-3 text-sm">
      <For each={props.token.parts}>
        {p => (
          <div class="space-y-2">
            <div class="flex flex-wrap items-baseline gap-2">
              <span class="text-muted-foreground">辞書形</span>
              <Show
                when={props.onLemma}
                fallback={
                  <A href={lexiconHref(readParams({ s: p.strongsId }))} class="greek text-xl font-semibold hover:underline" lang="grc">
                    {p.lemma}
                  </A>
                }
              >
                {onLemma => (
                  <button type="button" class="greek text-xl font-semibold hover:underline" lang="grc" onClick={() => onLemma()(p.strongsId)}>
                    {p.lemma}
                  </button>
                )}
              </Show>
              <Badge variant="outline" class="font-mono">
                {p.strongsId}
              </Badge>
              <span>{p.glossJa ?? p.gloss}</span>
              <Show when={p.glossJa && p.gloss}>
                <span class="text-xs text-muted-foreground" lang="en">
                  {p.gloss}
                </span>
              </Show>
            </div>
            <MorphBadges code={p.morphology} />
            <Suspense>
              <LemmaMemo strongsId={p.strongsId} />
            </Suspense>
            <Show when={props.onLemma}>
              {onLemma => (
                <Button variant="outline" size="sm" class="h-8" onClick={() => onLemma()(p.strongsId)}>
                  <Library class="size-4" aria-hidden="true" /> {p.lemma} のコンコルダンス
                </Button>
              )}
            </Show>
          </div>
        )}
      </For>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt class="text-muted-foreground">転写</dt>
        <dd>{props.token.transliteration}</dd>
        <dt class="text-muted-foreground">文脈訳</dt>
        <dd>{props.token.english}</dd>
        <dt class="text-muted-foreground">校訂版</dt>
        <dd class="break-all font-mono">{props.token.editionInfo}</dd>
        <Show when={na28Shift(props.token)}>
          <dt class="text-muted-foreground">語順</dt>
          <dd>NA28 では位置が異なります（{na28Shift(props.token)}）</dd>
        </Show>
      </dl>
    </div>
  );
}

/** The user's memo for a lemma (same editor as the lexicon page); shares the lemma-detail query with ConcordanceDialog. */
function LemmaMemo(props: { strongsId: string }) {
  const detail = createAsync(() => lemmaDetailQuery(props.strongsId));
  return <Show when={detail()}>{d => <NoteEditor strongsId={d().strongsId} notes={d().notes} />}</Show>;
}
