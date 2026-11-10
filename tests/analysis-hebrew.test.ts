import { describe, expect, it } from "vitest";
import { buildHebrewPrompt, hebrewText } from "~/server/analysis-hebrew";
import { reconcileHebrewAnalysis, type HebrewAnalysis } from "~/server/analysis-schema";
import type { Token, VerseTokens } from "~/server/lexicon";

const tok = (position: number, surface: string, lemma: string, strongsId: string, morphology: string, extra: Partial<Token> = {}): Token => ({
  position,
  surface,
  transliteration: null,
  english: null,
  editionInfo: "",
  wordType: "L",
  segments: null,
  ketiv: null,
  ketivGloss: null,
  engRef: null,
  parts: [{ lemmaId: 1, strongsId, lemma, gloss: null, glossJa: null, morphology }],
  ...extra,
});

// Gen 1:3 (abridged): וַיֹּאמֶר אֱלֹהִים יְהִי־אוֹר
const gen13: VerseTokens = {
  book: "Gen",
  chapter: 1,
  verse: 3,
  tokens: [
    tok(1, "וַיֹּ֥אמֶר", "אָמַר", "H0559", "HVqw3ms", {
      segments: [
        { k: "affix", h: "וַ", s: "H9001", m: "Hc" },
        { k: "root", h: "יֹּ֥אמֶר", s: "H0559", m: "HVqw3ms" },
      ],
    }),
    tok(2, "אֱלֹהִ֖ים", "אֱלֹהִים", "H0430G", "HNcmpa"),
    tok(3, "יְהִ֣י־", "הָיָה", "H1961", "HVqj3ms"),
    tok(4, "א֑וֹר", "אוֹר", "H0216", "HNcbsa", { ketiv: "אור", ketivGloss: null }),
  ],
};

const analysis = (verbPositions: number[]): HebrewAnalysis => ({
  overview: "",
  syntax: { summary: "", clauses: [] },
  wordRoles: [
    { position: 1, role: "述語動詞" },
    { position: 9, role: "存在しない語" },
  ],
  targetWord: { position: 99, syntacticRole: "", formExplanation: "", usageNote: "" },
  verbs: {
    items: verbPositions.map(position => ({ position, formation: "", stemMeaning: "", function: "", comparison: "" })),
    absenceNote: "",
  },
  translation: { literal: "", natural: "", decisions: [] },
  cautions: { grammaticalFacts: [], interpretiveNotes: [] },
});

describe("reconcileHebrewAnalysis", () => {
  it("keeps verb items only for words the data marks as verbs, once each, in text order", () => {
    const r = reconcileHebrewAnalysis(analysis([3, 2, 1, 3]), gen13, 1);
    expect(r.verbs.items.map(i => i.position)).toEqual([1, 3]);
    expect(r.wordRoles.map(w => w.position)).toEqual([1]);
    expect(r.targetWord.position).toBe(1);
  });

  it("notes a verbless (nominal) clause", () => {
    const nominal: VerseTokens = { ...gen13, tokens: [gen13.tokens[1], gen13.tokens[3]] };
    expect(reconcileHebrewAnalysis(analysis([]), nominal, 2).verbs.absenceNote).toContain("動詞がありません");
  });
});

describe("buildHebrewPrompt", () => {
  it("gives the model the fixed data: segments, decoded morphology, Ketiv and the verbs", () => {
    const prompt = buildHebrewPrompt(gen13, gen13.tokens[0], "H0559", { "Gen.1.3": 'And God said, "Let there be light,"' }, { prev: null, next: null });
    expect(prompt).toContain("Genesis 1:3（Gen.1.3、MT の章節）");
    expect(prompt).toContain("וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י־א֑וֹר"); // maqqef joins words
    expect(prompt).toContain("［分解: וַ + יֹּ֥אמֶר］");
    expect(prompt).toContain("HVqw3ms = 動詞 Qal ワイイクトル（継続未完了） 3人称 男性 単数");
    expect(prompt).toContain("接辞: וַ（H9001, Hc = 接続詞 ワイイクトルのワウ）");
    expect(prompt).toContain("［ケレ。ケティブ: אור］");
    expect(prompt).toMatch(/## この節の動詞（確定データより）\n#1: .*\n#3: /);
  });

  it("joins words with maqqef without a space", () => {
    expect(hebrewText(gen13)).toBe("וַיֹּ֥אמֶר אֱלֹהִ֖ים יְהִ֣י־א֑וֹר");
  });
});
