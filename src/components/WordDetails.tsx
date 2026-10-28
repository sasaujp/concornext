import { A } from "@solidjs/router";
import { For, Show } from "solid-js";
import { na28Shift } from "~/components/GreekVerse";
import { MorphBadges } from "~/components/MorphBadges";
import { Badge } from "~/components/ui/badge";
import type { Token } from "~/lib/queries";
import { lexiconHref, readParams } from "~/lib/url";

export const plainSurface = (t: Token) => t.surface.replace(/[¶,.;·:]+/g, "");

/** Confirmed (STEPBible) data for one word: lemma(s) with gloss and morphology, then transliteration etc. */
export function WordDetails(props: { token: Token }) {
  return (
    <div class="space-y-3 text-sm">
      <For each={props.token.parts}>
        {p => (
          <div class="space-y-2">
            <div class="flex flex-wrap items-baseline gap-2">
              <span class="text-muted-foreground">辞書形</span>
              <A href={lexiconHref(readParams({ s: p.strongsId }))} class="greek text-xl font-semibold hover:underline" lang="grc">
                {p.lemma}
              </A>
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
