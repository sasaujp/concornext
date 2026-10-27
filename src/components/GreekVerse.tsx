import { For, Show } from "solid-js";
import { summarizeMorphology, decodeMorphology } from "~/lib/morph";
import type { Token } from "~/lib/queries";

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
export const hitMarker = (i: number) => CIRCLED[i] ?? `(${i + 1})`;

function tokenTitle(t: Token) {
  return t.parts
    .map(p => `${p.lemma} ${p.strongsId} — ${summarizeMorphology(decodeMorphology(p.morphology))}${p.glossJa ?? p.gloss ? `「${p.glossJa ?? p.gloss}」` : ""}`)
    .join("\n");
}

/** NA28 word order shift recorded by TAGNT for this token, if any (e.g. "»2"). */
export function na28Shift(t: Token): string | null {
  const m = t.editionInfo.match(/(?:^|\+)NA28([«»]\d+)/);
  return m ? m[1] : null;
}

/**
 * Greek verse text built from TAGNT tokens. Highlighted tokens are numbered when the
 * lemma occurs more than once, so each occurrence can be identified.
 */
export function GreekVerse(props: {
  tokens: Token[];
  highlight?: number[];
  selected?: number;
  onSelect?: (position: number) => void;
  size?: "md" | "lg";
}) {
  const hl = () => props.highlight ?? [];
  const numbered = () => hl().length > 1;
  return (
    <p class={`greek ${props.size === "lg" ? "text-[1.6rem] leading-[2.1]" : "text-[1.3rem]"}`} lang="grc">
      <For each={props.tokens}>
        {t => {
          const idx = () => hl().indexOf(t.position);
          const isHit = () => idx() >= 0;
          const isSelected = () => props.selected === t.position;
          const shift = na28Shift(t);
          const cls = () =>
            [
              "rounded px-0.5 transition-colors",
              isHit() ? "bg-highlight text-highlight-foreground font-bold" : "",
              isSelected() ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
              props.onSelect ? "cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" : "",
            ].join(" ");
          const para = t.surface.includes("¶");
          const content = (
            <>
              {t.surface.replace("¶", "")}
              <Show when={isHit() && numbered()}>
                <sup class="ml-0.5 font-sans text-[0.6em] font-semibold">{hitMarker(idx())}</sup>
              </Show>
              <Show when={para}>
                <span class="ml-0.5 font-sans text-[0.6em] text-muted-foreground" aria-label="段落の区切り">
                  ¶
                </span>
              </Show>
              <Show when={shift}>
                <sup class="ml-0.5 font-sans text-[0.55em] text-muted-foreground" title={`NA28 ではこの語の位置が異なります（${shift}）`}>
                  ↔
                </sup>
              </Show>
            </>
          );
          return (
            <>
              <Show
                when={props.onSelect}
                fallback={
                  <span class={cls()} title={tokenTitle(t)}>
                    {content}
                  </span>
                }
              >
                <button
                  type="button"
                  class={cls()}
                  title={tokenTitle(t)}
                  aria-pressed={isSelected()}
                  onClick={() => props.onSelect?.(t.position)}
                >
                  {content}
                </button>
              </Show>{" "}
            </>
          );
        }}
      </For>
    </p>
  );
}
