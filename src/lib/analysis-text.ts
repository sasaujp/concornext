/**
 * Plain-text (Markdown) versions of each AI analysis section, for copying into another AI chat.
 * Every section starts with the passage, the Greek text and the target word so it stands alone.
 */
import { decodeMorphology, summarizeMorphology } from "~/lib/morph";
import type { Analysis } from "~/server/analysis-schema";
import type { Token } from "~/server/lexicon";

export type AnalysisSectionKey = "syntax" | "morph" | "aorist" | "translation" | "notes";

export const SECTION_TITLES: Record<AnalysisSectionKey, string> = {
  syntax: "A. 構文",
  morph: "B. 語形",
  aorist: "C. アオリスト",
  translation: "D. 翻訳",
  notes: "E. 注意",
};

const clean = (s: string) => s.replace(/¶/g, "").replace(/[,.;·:]+$/g, "").trim();
const morph = (t: Token) => t.parts.map(p => `${p.morphology}（${summarizeMorphology(decodeMorphology(p.morphology))}）`).join(" ＋ ");
const glossOf = (p: Token["parts"][number]) => [p.glossJa, p.gloss].filter(Boolean).join(" / ");
const lemmas = (t: Token) => t.parts.map(p => `${p.lemma}（${p.strongsId}${glossOf(p) ? `, ${glossOf(p)}` : ""}）`).join(" ＋ ");
const bullets = (items: string[]) => items.map(x => `- ${x}`).join("\n");

export function sectionAsText(
  key: AnalysisSectionKey,
  ctx: { reference: string; analysis: Analysis; tokens: Token[]; english?: string | null },
): string {
  const { analysis: a, tokens } = ctx;
  const at = (pos: number) => tokens.find(t => t.position === pos);
  const target = at(a.targetWord.position);

  const header = [
    `# ${ctx.reference} — ${SECTION_TITLES[key]}`,
    "",
    `ギリシャ語本文（STEPBible TAGNT の NA28 本文語）: ${tokens.map(t => t.surface.replace(/¶/g, "")).join(" ")}`,
    ...(ctx.english ? [`BSB 英訳: ${ctx.english}`] : []),
    ...(target ? [`対象語: ${clean(target.surface)} ← ${lemmas(target)}`] : []),
    "",
  ];

  let body: string[];
  switch (key) {
    case "syntax":
      body = [a.syntax.summary, "", ...a.syntax.clauses.map(c => `- 【${c.kind}】${c.greek}\n  ${c.explanation}`)];
      break;
    case "morph":
      body = [
        "## 対象語",
        ...(target ? [`${clean(target.surface)} ← ${lemmas(target)}`, `形態素（確定データ）: ${morph(target)}`] : []),
        `文中での役割: ${a.targetWord.syntacticRole}`,
        `語形の成り立ち: ${a.targetWord.formExplanation}`,
        `用法: ${a.targetWord.usageNote}`,
        "",
        "## 各語の形態素（確定データ）と統語的役割（AI）",
        ...tokens.map(t => {
          const role = a.wordRoles.find(w => w.position === t.position)?.role;
          return `- #${t.position} ${clean(t.surface)} ← ${t.parts.map(p => p.lemma).join(" + ")}｜${morph(t)}${role ? `｜${role}` : ""}`;
        }),
      ];
      break;
    case "aorist":
      body = a.aorist.items.length
        ? a.aorist.items.flatMap(i => {
            const t = at(i.position);
            return [
              `## ${t ? `${clean(t.surface)} ← ${lemmas(t)}` : `#${i.position}`}`,
              ...(t ? [`形態素（確定データ）: ${morph(t)}`] : []),
              `形態: ${i.formation}`,
              `相（アスペクト）: ${i.aspect}`,
              `時間的位置づけ: ${i.timeReference}`,
              `他の時制との比較: ${i.comparison}`,
              "",
            ];
          })
        : [a.aorist.absenceNote || "この節にはアオリスト形の語はありません。"];
      break;
    case "translation":
      body = [
        "## 逐語訳（原文の構造を保持）",
        a.translation.literal,
        "",
        "## 自然な日本語訳",
        a.translation.natural,
        "",
        "## 翻訳上の文法的判断",
        bullets(a.translation.decisions),
      ];
      break;
    case "notes":
      body = ["## 文法的事実", bullets(a.cautions.grammaticalFacts), "", "## 解釈・釈義上の推論", bullets(a.cautions.interpretiveNotes)];
      break;
  }
  return [...header, ...body].join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
