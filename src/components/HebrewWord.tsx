import { For, Show } from "solid-js";
import type { WordSegment } from "~/lib/queries";
import { cn } from "~/lib/utils";

/**
 * A Hebrew word split into its segments as tagged in TAHOT, right to left: prefixes, the root word(s)
 * (bold; `highlight` = the root being looked at) and suffixes, e.g. ב + רֵאשִׁית. Punctuation is left out.
 */
export function SegmentBreakdown(props: { segments: WordSegment[]; highlight?: string; class?: string }) {
  const parts = () => props.segments.filter(s => s.k !== "punctuation");
  return (
    <span class={cn("hebrew inline-flex flex-wrap items-baseline gap-x-1", props.class)} lang="he" dir="rtl">
      <For each={parts()}>
        {(s, i) => (
          <>
            <Show when={i() > 0}>
              <span class="font-sans text-xs text-muted-foreground" aria-hidden="true">
                {s.k === "separator" || parts()[i() - 1].k === "separator" ? "" : "+"}
              </span>
            </Show>
            <Show when={s.k !== "separator"} fallback={<span class="w-2" aria-hidden="true" />}>
              <span
                class={cn(s.k === "root" ? "font-semibold" : "text-muted-foreground", s.k === "root" && props.highlight === s.s && "text-primary")}
                title={[s.t, s.s, s.m].filter(Boolean).join(" · ")}
              >
                {s.h}
              </span>
            </Show>
          </>
        )}
      </For>
    </span>
  );
}

/** Short Japanese label for a TAHOT source type (L, Q(K), R …), or null for plain Leningrad text. */
export function sourceLabel(wordType: string): string | null {
  if (wordType.startsWith("Q")) return "ケレ（欄外の読み）";
  if (wordType.startsWith("R")) return "復元（並行箇所から補った本文）";
  return null;
}
