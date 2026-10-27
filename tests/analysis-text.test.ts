import { describe, expect, it } from "vitest";
import { sectionAsText } from "~/lib/analysis-text";
import type { Analysis } from "~/server/analysis-schema";
import type { Token } from "~/server/lexicon";

const tok = (position: number, surface: string, lemma: string, strongsId: string, morphology: string): Token => ({
  position,
  surface,
  transliteration: null,
  english: null,
  editionInfo: "NA28",
  wordType: "NKO",
  parts: [{ lemmaId: 1, strongsId, lemma, gloss: null, glossJa: null, morphology }],
});
const tokens = [tok(1, "Ἐγένετο", "γίνομαι", "G1096", "V-2ADI-3S"), tok(2, "ἄνθρωπος,¶", "ἄνθρωπος", "G0444", "N-NSM")];
const analysis: Analysis = {
  overview: "概要です。",
  syntax: { summary: "文の中心は Ἐγένετο です。", clauses: [{ greek: "Ἐγένετο ἄνθρωπος", kind: "主節", explanation: "主語は ἄνθρωπος です。" }] },
  wordRoles: [{ position: 1, role: "述語動詞" }, { position: 2, role: "主語" }],
  targetWord: { position: 1, syntacticRole: "述語動詞です。", formExplanation: "ἐ-γέν-ετο です。", usageNote: "現れた、の意味です。" },
  aorist: { items: [{ position: 1, formation: "第2アオリストです。", aspect: "完結相です。", timeReference: "過去です。", comparison: "未完了過去なら…" }], absenceNote: "" },
  translation: { literal: "生じた 人", natural: "人が現れました。", decisions: ["「現れた」と訳しました。"] },
  cautions: { grammaticalFacts: ["事実です。"], interpretiveNotes: ["推論です。"] },
};
const ctx = { reference: "ヨハネ 1:6（John 1:6）", analysis, tokens, english: "There came a man" };

describe("sectionAsText", () => {
  it("starts every section with the passage, Greek text and target word", () => {
    const text = sectionAsText("syntax", ctx);
    expect(text).toMatch(/^# ヨハネ 1:6（John 1:6） — A\. 構文\n/);
    expect(text).toContain("ギリシャ語本文（STEPBible TAGNT の NA28 本文語）: Ἐγένετο ἄνθρωπος,");
    expect(text).not.toContain("¶");
    expect(text).toContain("BSB 英訳: There came a man");
    expect(text).toContain("対象語: Ἐγένετο ← γίνομαι（G1096）");
    expect(text).toContain("- 【主節】Ἐγένετο ἄνθρωπος\n  主語は ἄνθρωπος です。");
  });

  it("includes the deterministic morphology in B and C", () => {
    expect(sectionAsText("morph", ctx)).toContain("- #1 Ἐγένετο ← γίνομαι｜V-2ADI-3S（動詞・第2アオリスト・中動態（デポーネント）・直説法・3人称・単数）｜述語動詞");
    const c = sectionAsText("aorist", ctx);
    expect(c).toContain("## Ἐγένετο ← γίνομαι（G1096）");
    expect(c).toContain("相（アスペクト）: 完結相です。");
  });

  it("states the absence of aorists", () => {
    const none = { ...ctx, analysis: { ...analysis, aorist: { items: [], absenceNote: "アオリストはありません。" } } };
    expect(sectionAsText("aorist", none)).toContain("アオリストはありません。");
  });

  it("formats translation and notes as lists", () => {
    expect(sectionAsText("translation", ctx)).toContain("## 自然な日本語訳\n人が現れました。");
    expect(sectionAsText("notes", ctx)).toContain("## 解釈・釈義上の推論\n- 推論です。");
  });
});
