import { A, useSearchParams } from "@solidjs/router";
import { ScrollText } from "lucide-solid";
import { For, Show } from "solid-js";
import { LemmaList } from "~/components/LemmaList";
import { LemmaPanel } from "~/components/LemmaPanel";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { displayPassage, parsePassage, type Testament } from "~/lib/books";
import { scriptAttrs } from "~/lib/script";
import { cn } from "~/lib/utils";
import { type LexiconParams, lexiconHref, passageHref, readParams } from "~/lib/url";

const EXAMPLES: Record<Testament, { s: string; word: string; note: string }[]> = {
  NT: [
    { s: "G3056", word: "λόγος", note: "ことば" },
    { s: "G1096", word: "γίνομαι", note: "なる・生じる" },
    { s: "G2638", word: "καταλαμβάνω", note: "捕らえる・理解する" },
    { s: "G4637", word: "σκηνόω", note: "幕屋を張る" },
    { s: "G4100", word: "πιστεύω", note: "信じる" },
    { s: "G3306", word: "μένω", note: "とどまる" },
  ],
  OT: [
    { s: "H1254A", word: "בָּרָא", note: "創造する" },
    { s: "H7307G", word: "רוּחַ", note: "霊・息・風" },
    { s: "H2617A", word: "חֶסֶד", note: "慈しみ・誠実" },
    { s: "H1285", word: "בְּרִית", note: "契約" },
    { s: "H8085G", word: "שָׁמַע", note: "聞く" },
    { s: "H6944G", word: "קֹדֶשׁ", note: "聖さ・聖なるもの" },
  ],
};

const PASSAGE_EXAMPLES: Record<Testament, string[]> = {
  NT: ["Jhn.1.1-18", "Php.2.5-11", "1Co.13"],
  OT: ["Gen.1", "Psa.23", "Isa.53"],
};

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
  const testament = () => readParams(search).testament;
  return (
    <div class="mx-auto max-w-2xl p-6 lg:p-10">
      <Card>
        <CardHeader>
          <CardTitle>見出し語を選んでください</CardTitle>
          <CardDescription>
            {testament() === "OT"
              ? "左の一覧から語を選ぶと、旧約聖書（TAHOT、ヘブライ語・アラム語）での全出現箇所を聖書順に表示します。一覧の上で新約・旧約を切り替えられます。"
              : "左の一覧から語を選ぶと、新約聖書（TAGNT の NA28 本文語）での全出現箇所を聖書順に表示します。各節から文法解析（AI）を開けます。一覧の上で新約・旧約を切り替えられます。"}
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <ul class="grid gap-2 sm:grid-cols-2">
            <For each={EXAMPLES[testament()]}>
              {ex => (
                <li>
                  <A
                    href={lexiconHref(readParams(search), { s: ex.s, book: null, cp: 1 })}
                    class="flex items-baseline gap-3 rounded-md border px-3 py-2 hover:bg-accent"
                  >
                    <span {...scriptAttrs(ex.word, "text-xl font-semibold")}>{ex.word}</span>
                    <span class="text-sm text-muted-foreground">{ex.note}</span>
                  </A>
                </li>
              )}
            </For>
          </ul>
          <div class="space-y-3 border-t pt-5">
            <p class="text-sm text-muted-foreground">
              章・節から始めることもできます。ヘッダーの「本文」で書・章・節を選ぶと、その範囲の原文（ギリシャ語・ヘブライ語）を表示します。語をクリックすると語形と辞書形が表示され、そこからコンコルダンスや文法解析に進めます。
            </p>
            <ul class="flex flex-wrap gap-2">
              <For each={PASSAGE_EXAMPLES[testament()]}>
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
