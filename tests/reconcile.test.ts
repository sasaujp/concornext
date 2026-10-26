import { describe, expect, it } from "vitest";
import { reconcileAnalysis, type Analysis } from "~/server/analysis-schema";
import type { VerseTokens } from "~/server/lexicon";

const tok = (position: number, surface: string, morphology: string) => ({
  position,
  surface,
  transliteration: null,
  english: null,
  editionInfo: "NA28",
  wordType: "NKO",
  parts: [{ lemmaId: 1, strongsId: "G0001", lemma: surface, gloss: null, morphology }],
});

// Jhn 1:6 (abridged): Ἐγένετο (aorist) ἄνθρωπος ἀπεσταλμένος (perfect participle)
const jhn16: VerseTokens = { book: "Jhn", chapter: 1, verse: 6, tokens: [tok(1, "Ἐγένετο", "V-2ADI-3S"), tok(2, "ἄνθρωπος", "N-NSM"), tok(3, "ἀπεσταλμένος", "V-RPP-NSM")] };
// Jhn 1:1 (abridged): no aorist
const jhn11: VerseTokens = { book: "Jhn", chapter: 1, verse: 1, tokens: [tok(1, "Ἐν", "PREP"), tok(3, "ἦν", "V-IAI-3S"), tok(5, "λόγος", "N-NSM")] };

const item = (position: number) => ({ position, formation: "f", aspect: "a", timeReference: "t", comparison: "c" });
const base = (items: ReturnType<typeof item>[]): Analysis => ({
  overview: "",
  syntax: { summary: "", clauses: [] },
  wordRoles: [
    { position: 1, role: "述語" },
    { position: 99, role: "存在しない語" },
  ],
  targetWord: { position: 42, syntacticRole: "", formExplanation: "", usageNote: "" },
  aorist: { items, absenceNote: "なし" },
  translation: { literal: "", natural: "", decisions: [] },
  cautions: { grammaticalFacts: [], interpretiveNotes: [] },
});

describe("reconcileAnalysis", () => {
  it("drops aorist claims about non-aorist words (perfect participle)", () => {
    const r = reconcileAnalysis(base([item(3), item(1), item(1)]), jhn16, 1);
    expect(r.aorist.items.map(i => i.position)).toEqual([1]);
    expect(r.aorist.absenceNote).toBe("");
  });

  it("keeps an explicit absence note when the verse has no aorist", () => {
    const r = reconcileAnalysis(base([item(3)]), jhn11, 5);
    expect(r.aorist.items).toEqual([]);
    expect(r.aorist.absenceNote).toBe("なし");
  });

  it("pins the target position and filters unknown word roles", () => {
    const r = reconcileAnalysis(base([]), jhn16, 1);
    expect(r.targetWord.position).toBe(1);
    expect(r.wordRoles.map(w => w.position)).toEqual([1]);
  });
});
