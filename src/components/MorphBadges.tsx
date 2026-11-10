import { For, Show } from "solid-js";
import { Badge } from "~/components/ui/badge";
import { decodeMorphology, summarizeMorphology } from "~/lib/morph";
import { decodeHebrewMorphology, summarizeHebrewMorphology } from "~/lib/morph-hebrew";

/** Grammar of one morphology code as compact badges. Aorists get a distinct badge. */
export function MorphBadges(props: { code: string; class?: string; strongsId?: string }) {
  return (
    <Show when={!props.strongsId?.startsWith("H")} fallback={<HebrewMorphBadges code={props.code} class={props.class} />}>
      <GreekMorphBadges code={props.code} class={props.class} />
    </Show>
  );
}

/** Hebrew/Aramaic (TEHMC) code: part of speech, then the verb stem and form (highlighted), then person/gender/number/state. */
function HebrewMorphBadges(props: { code: string; class?: string }) {
  const m = () => decodeHebrewMorphology(props.code);
  const items = () => [m().kind, m().person, m().gender, m().number, m().state].filter((x): x is string => !!x);
  return (
    <span class={`inline-flex flex-wrap items-center gap-1 ${props.class ?? ""}`} title={summarizeHebrewMorphology(m())}>
      <Badge variant="outline" class="font-normal">
        {m().pos}
      </Badge>
      <Show when={m().stem}>
        <Badge variant="warning" class="font-medium">
          {m().stem}
        </Badge>
      </Show>
      <Show when={m().form}>
        <Badge variant="secondary" class="font-medium">
          {m().form}
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

function GreekMorphBadges(props: { code: string; class?: string }) {
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
