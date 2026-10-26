import { z } from "zod";
import { decodeMorphology } from "~/lib/morph";
import type { VerseTokens } from "./lexicon";

/** Structured output requested from Claude. Positions refer to TAGNT word numbers in the verse. */
export const AnalysisSchema = z.object({
  overview: z.string().describe("この節の文法的な要点（2〜4文）"),
  syntax: z.object({
    summary: z.string().describe("文全体の構造の説明（主節・従属節の関係）"),
    clauses: z
      .array(
        z.object({
          greek: z.string().describe("節・句のギリシャ語（本文からそのまま引用）"),
          kind: z.string().describe("主節 / 従属節（関係節・目的節など）/ 分詞句 / 不定詞句 など"),
          explanation: z.string().describe("主語・述語・目的語・補語・修飾関係の説明"),
        }),
      )
      .describe("節・句ごとの分析（本文の順序で）"),
  }),
  wordRoles: z
    .array(
      z.object({
        position: z.number().int().describe("語の位置番号（入力の # 番号）"),
        role: z.string().describe("文中での統語的役割（例: 主語、述語動詞、前置詞の目的語、限定用法の冠詞）"),
      }),
    )
    .describe("各語の統語的役割。入力にある全ての語について、入力の位置番号で"),
  targetWord: z.object({
    position: z.number().int(),
    syntacticRole: z.string().describe("対象語の文中での役割"),
    formExplanation: z.string().describe("辞書形から実際の語形への変化（語幹・加音・重複・語尾など）の説明"),
    usageNote: z.string().describe("この文脈での意味・用法"),
  }),
  aorist: z.object({
    items: z
      .array(
        z.object({
          position: z.number().int().describe("アオリスト形の語の位置番号（入力でアオリストと明示された語のみ）"),
          formation: z.string().describe("第1/第2アオリスト・受動アオリスト等の形態上の特徴、語幹・加音・語尾の説明"),
          aspect: z.string().describe("完結相（perfective aspect）としてこの動作をどう提示しているか"),
          timeReference: z.string().describe("文脈における時間的位置づけ（法によって異なる点に注意）"),
          comparison: z.string().describe("現在形・未完了過去・完了形であった場合との比較"),
        }),
      )
      .describe("入力でアオリストとされた語のみ。無ければ空配列"),
    absenceNote: z.string().describe("アオリストが無い場合、その旨と節内の時制・相の要点。ある場合は空文字列"),
  }),
  translation: z.object({
    literal: z.string().describe("原文の語順・構造を保持した逐語訳"),
    natural: z.string().describe("自然な日本語訳"),
    decisions: z.array(z.string()).describe("翻訳上の文法的判断"),
  }),
  cautions: z.object({
    grammaticalFacts: z.array(z.string()).describe("本文と形態素から確実に言える文法的事実"),
    interpretiveNotes: z.array(z.string()).describe("解釈・釈義に関わる推論（推論であることが分かる書き方で）"),
  }),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/** Drops anything in the model output that contradicts the deterministic morphology. */
export function reconcileAnalysis(analysis: Analysis, verse: VerseTokens, targetPosition: number): Analysis {
  const positions = new Set(verse.tokens.map(t => t.position));
  const aoristPositions = new Set(verse.tokens.filter(t => t.parts.some(p => decodeMorphology(p.morphology).isAorist)).map(t => t.position));
  const items = analysis.aorist.items.filter(i => aoristPositions.has(i.position));
  // De-duplicate by position, keep order of the text.
  const seen = new Set<number>();
  const dedup = items.filter(i => (seen.has(i.position) ? false : (seen.add(i.position), true))).sort((a, b) => a.position - b.position);
  return {
    ...analysis,
    wordRoles: analysis.wordRoles.filter(w => positions.has(w.position)),
    targetWord: { ...analysis.targetWord, position: targetPosition },
    aorist: {
      items: dedup,
      absenceNote:
        aoristPositions.size === 0
          ? analysis.aorist.absenceNote || "この節にはアオリスト形の語はありません。"
          : "",
    },
  };
}
