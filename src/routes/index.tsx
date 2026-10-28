import { A, useSearchParams } from "@solidjs/router";
import { ScrollText } from "lucide-solid";
import { For, Show } from "solid-js";
import { LemmaList } from "~/components/LemmaList";
import { LemmaPanel } from "~/components/LemmaPanel";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { displayPassage, parsePassage } from "~/lib/books";
import { cn } from "~/lib/utils";
import { type LexiconParams, lexiconHref, passageHref, readParams } from "~/lib/url";

const EXAMPLES = [
  { s: "G3056", greek: "λόγος", note: "ことば" },
  { s: "G1096", greek: "γίνομαι", note: "なる・生じる" },
  { s: "G2638", greek: "καταλαμβάνω", note: "捕らえる・理解する" },
  { s: "G4637", greek: "σκηνόω", note: "幕屋を張る" },
  { s: "G4100", greek: "πιστεύω", note: "信じる" },
  { s: "G3306", greek: "μένω", note: "とどまる" },
];

const PASSAGE_EXAMPLES = ["Jhn.1.1-18", "Php.2.5-11", "1Co.13"];

export default function Lexicon() {
  const [search] = useSearchParams<LexiconParams>();
  const params = () => readParams(search);
  return (
    <div class="mx-auto grid h-[calc(100dvh-3.5rem)] max-w-[1600px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside class={cn("min-h-0 border-r", params().s ? "hidden lg:block" : "block")}>
        <LemmaList />
      </aside>
      <div id="detail-scroll" class={cn("min-h-0 overflow-y-auto overflow-x-hidden", params().s ? "block" : "hidden lg:block")}>
        <Show when={params().s} keyed fallback={<Welcome />}>
          {s => <LemmaPanel strongsId={s} />}
        </Show>
      </div>
    </div>
  );
}

function Welcome() {
  const [search] = useSearchParams<LexiconParams>();
  return (
    <div class="mx-auto max-w-2xl p-6 lg:p-10">
      <Card>
        <CardHeader>
          <CardTitle>見出し語を選んでください</CardTitle>
          <CardDescription>
            左の一覧から語を選ぶと、新約聖書（TAGNT の NA28 本文語）での全出現箇所を聖書順に表示します。各節から文法解析（AI）を開けます。
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <ul class="grid gap-2 sm:grid-cols-2">
            <For each={EXAMPLES}>
              {ex => (
                <li>
                  <A
                    href={lexiconHref(readParams(search), { s: ex.s, book: null, cp: 1 })}
                    class="flex items-baseline gap-3 rounded-md border px-3 py-2 hover:bg-accent"
                  >
                    <span class="greek text-xl font-semibold" lang="grc">
                      {ex.greek}
                    </span>
                    <span class="text-sm text-muted-foreground">{ex.note}</span>
                  </A>
                </li>
              )}
            </For>
          </ul>
          <div class="space-y-3 border-t pt-5">
            <p class="text-sm text-muted-foreground">
              章・節から始めることもできます。ヘッダーの「本文」で書・章・節を選ぶと、その範囲のギリシャ語本文を表示します。語をクリックすると語形と辞書形が表示され、そこからコンコルダンスや文法解析に進めます。
            </p>
            <ul class="flex flex-wrap gap-2">
              <For each={PASSAGE_EXAMPLES}>
                {r => (
                  <li>
                    <Button as={A} href={passageHref(r)} variant="outline" size="sm">
                      <ScrollText class="size-4" aria-hidden="true" />
                      {displayPassage(parsePassage(r)!)}
                    </Button>
                  </li>
                )}
              </For>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
