import { For, Show } from "solid-js";
import { CopyButton } from "~/components/CopyButton";
import { MorphBadges } from "~/components/MorphBadges";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsIndicator, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type AnalysisSectionKey, sectionAsText } from "~/lib/analysis-text";
import type { AnalysisResponse, Token } from "~/lib/queries";

type Ok = Extract<AnalysisResponse, { status: "ok" }>;

const clean = (s: string) => s.replace(/[¶,.;·:]+$/g, "").replace("¶", "");

function Section(props: { title: string; children: import("solid-js").JSX.Element }) {
  return (
    <section class="space-y-2">
      <h3 class="text-sm font-semibold">{props.title}</h3>
      {props.children}
    </section>
  );
}

function Prose(props: { text: string }) {
  return <p class="whitespace-pre-line text-sm leading-7">{props.text}</p>;
}

export function AnalysisView(props: { result: Ok; tokens: Token[]; reference: string; english?: () => string | null | undefined }) {
  const a = () => props.result.analysis;
  const tokenAt = (pos: number) => props.tokens.find(t => t.position === pos);
  const roleOf = (pos: number) => a().wordRoles.find(w => w.position === pos)?.role;
  /** "Copy" for one tab: the section as Markdown, headed by the passage so it can be pasted into another AI. */
  const copyBar = (key: AnalysisSectionKey) => (
    <div class="flex justify-end">
      <CopyButton
        label="このタブをコピー"
        text={() => sectionAsText(key, { reference: props.reference, analysis: a(), tokens: props.tokens, english: props.english?.() })}
      />
    </div>
  );

  return (
    <div class="space-y-4">
      <p class="text-sm leading-7">{a().overview}</p>
      <Tabs defaultValue="syntax">
        <TabsList class="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="syntax">A. 構文</TabsTrigger>
          <TabsTrigger value="morph">B. 語形</TabsTrigger>
          <TabsTrigger value="aorist">C. アオリスト</TabsTrigger>
          <TabsTrigger value="translation">D. 翻訳</TabsTrigger>
          <TabsTrigger value="notes">E. 注意</TabsTrigger>
          <TabsIndicator />
        </TabsList>

        <TabsContent value="syntax" class="space-y-4 pt-3">
          {copyBar("syntax")}
          <Prose text={a().syntax.summary} />
          <ol class="space-y-3">
            <For each={a().syntax.clauses}>
              {c => (
                <li class="rounded-md border p-3">
                  <div class="flex flex-wrap items-baseline gap-2">
                    <span class="rounded bg-secondary px-1.5 py-0.5 text-xs">{c.kind}</span>
                    <span class="greek text-lg" lang="grc">
                      {c.greek}
                    </span>
                  </div>
                  <p class="mt-1 text-sm leading-7">{c.explanation}</p>
                </li>
              )}
            </For>
          </ol>
        </TabsContent>

        <TabsContent value="morph" class="space-y-4 pt-3">
          {copyBar("morph")}
          <Section title="対象語">
            <Show when={tokenAt(a().targetWord.position)}>
              {t => (
                <div class="space-y-2 rounded-md border p-3">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="greek text-xl font-semibold" lang="grc">
                      {clean(t().surface)}
                    </span>
                    <span class="greek text-muted-foreground" lang="grc">
                      ← {t().parts.map(p => p.lemma).join(" + ")}
                    </span>
                  </div>
                  <For each={t().parts}>{p => <MorphBadges code={p.morphology} />}</For>
                  <dl class="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                    <dt class="text-muted-foreground">文中での役割</dt>
                    <dd>{a().targetWord.syntacticRole}</dd>
                    <dt class="text-muted-foreground">語形の成り立ち</dt>
                    <dd class="leading-7">{a().targetWord.formExplanation}</dd>
                    <dt class="text-muted-foreground">用法</dt>
                    <dd class="leading-7">{a().targetWord.usageNote}</dd>
                  </dl>
                </div>
              )}
            </Show>
          </Section>
          <Section title="各語の形態素（確定データ）と統語的役割（AI）">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b text-left text-xs text-muted-foreground">
                    <th class="py-1.5 pr-2 font-medium">#</th>
                    <th class="py-1.5 pr-2 font-medium">語形</th>
                    <th class="py-1.5 pr-2 font-medium">辞書形</th>
                    <th class="py-1.5 pr-2 font-medium">形態素</th>
                    <th class="py-1.5 font-medium">役割</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={props.tokens}>
                    {t => (
                      <tr class={`border-b align-top ${t.position === a().targetWord.position ? "bg-highlight/40" : ""}`}>
                        <td class="py-1.5 pr-2 tabular-nums text-muted-foreground">{t.position}</td>
                        <td class="greek py-1.5 pr-2 text-base" lang="grc">
                          {clean(t.surface)}
                        </td>
                        <td class="greek py-1.5 pr-2 text-base" lang="grc">
                          {t.parts.map(p => p.lemma).join(" + ")}
                        </td>
                        <td class="py-1.5 pr-2">
                          <For each={t.parts}>{p => <MorphBadges code={p.morphology} />}</For>
                        </td>
                        <td class="py-1.5">{roleOf(t.position) ?? "—"}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="aorist" class="space-y-4 pt-3">
          {copyBar("aorist")}
          <Show when={a().aorist.items.length} fallback={<Prose text={a().aorist.absenceNote || "この節にはアオリスト形の語はありません。"} />}>
            <For each={a().aorist.items}>
              {item => (
                <article class="space-y-2 rounded-md border p-3">
                  <Show when={tokenAt(item.position)}>
                    {t => (
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="greek text-xl font-semibold" lang="grc">
                          {clean(t().surface)}
                        </span>
                        <span class="greek text-muted-foreground" lang="grc">
                          ← {t().parts.map(p => p.lemma).join(" + ")}
                        </span>
                        <For each={t().parts}>{p => <MorphBadges code={p.morphology} />}</For>
                      </div>
                    )}
                  </Show>
                  <dl class="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
                    <dt class="text-muted-foreground">形態</dt>
                    <dd class="leading-7">{item.formation}</dd>
                    <dt class="text-muted-foreground">相（アスペクト）</dt>
                    <dd class="leading-7">{item.aspect}</dd>
                    <dt class="text-muted-foreground">時間的位置づけ</dt>
                    <dd class="leading-7">{item.timeReference}</dd>
                    <dt class="text-muted-foreground">他の時制との比較</dt>
                    <dd class="leading-7">{item.comparison}</dd>
                  </dl>
                </article>
              )}
            </For>
          </Show>
        </TabsContent>

        <TabsContent value="translation" class="space-y-4 pt-3">
          {copyBar("translation")}
          <Section title="逐語訳（原文の構造を保持）">
            <Prose text={a().translation.literal} />
          </Section>
          <Section title="自然な日本語訳">
            <Prose text={a().translation.natural} />
          </Section>
          <Section title="翻訳上の文法的判断">
            <ul class="list-disc space-y-1 pl-5 text-sm leading-7">
              <For each={a().translation.decisions}>{d => <li>{d}</li>}</For>
            </ul>
          </Section>
        </TabsContent>

        <TabsContent value="notes" class="space-y-4 pt-3">
          {copyBar("notes")}
          <Section title="文法的事実">
            <ul class="list-disc space-y-1 pl-5 text-sm leading-7">
              <For each={a().cautions.grammaticalFacts}>{d => <li>{d}</li>}</For>
            </ul>
          </Section>
          <Section title="解釈・釈義上の推論">
            <ul class="list-disc space-y-1 pl-5 text-sm leading-7">
              <For each={a().cautions.interpretiveNotes}>{d => <li>{d}</li>}</For>
            </ul>
          </Section>
        </TabsContent>
      </Tabs>
      <Separator />
      <p class="text-xs text-muted-foreground">
        {props.result.cached ? "保存済みの解析" : "新規生成"} · {props.result.model} · prompt {props.result.promptVersion} · {props.result.sourceVersion} ·{" "}
        {props.result.createdAt.slice(0, 16).replace("T", " ")}
        <br />
        AI による説明は誤りを含むことがあります。形態素は STEPBible の確定データを優先してください。
      </p>
    </div>
  );
}
