import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { decodeMorphology, summarizeMorphology } from "~/lib/morph";

/** Grammar of one morphology code as compact badges. Aorists get a distinct badge. */
export function MorphBadges(props: { code: string; class?: string }) {
  const m = () => decodeMorphology(props.code);
  const items = () => [m().voice, m().mood, m().person, m().case, m().gender, m().number, ...m().extra].filter((x): x is string => !!x);
  return (
    <span class={`inline-flex flex-wrap items-center gap-1 ${props.class ?? ""}`} title={summarizeMorphology(m())}>
      <Badge variant="outline" class="font-normal">
        {m().pos}
      </Badge>
      <Show when={m().tense}>
        <Badge variant={m().isAorist ? "warning" : "secondary"} class="font-medium">
          {m().tense}
        </Badge>
      </Show>
      <For each={items()}>
        {x => (
          <Badge variant="secondary" class="font-normal">
            {x}
          </Badge>
        )}
      </For>
      <code class="ml-1 text-[11px] text-muted-foreground">{props.code}</code>
    </span>
  );
}
