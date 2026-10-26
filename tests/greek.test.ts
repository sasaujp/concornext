import { describe, expect, it } from "vitest";
import { containsGreek, normalizeGreek, normalizeLatin, parseStrongs, stripPunctuation } from "~/lib/greek";

describe("normalizeGreek", () => {
  it("ignores accents, breathings, iota subscript and case", () => {
    expect(normalizeGreek("λόγος")).toBe("λογοσ");
    expect(normalizeGreek("λογος")).toBe(normalizeGreek("λόγος"));
    expect(normalizeGreek("Ἐγένετο")).toBe(normalizeGreek("εγενετο"));
    expect(normalizeGreek("ἀρχῇ")).toBe("αρχη");
    expect(normalizeGreek("ἐσκήνωσεν")).toBe("εσκηνωσεν");
  });
  it("folds final sigma and drops punctuation", () => {
    expect(normalizeGreek("λόγος,")).toBe(normalizeGreek("ΛΟΓΟΣ"));
    expect(stripPunctuation("θεόν,")).toBe("θεόν");
    expect(stripPunctuation("λόγος.")).toBe("λόγος");
  });
  it("detects Greek input", () => {
    expect(containsGreek("λογος")).toBe(true);
    expect(containsGreek("logos")).toBe(false);
  });
});

describe("parseStrongs", () => {
  it("accepts several spellings", () => {
    expect(parseStrongs("G3056")).toEqual({ base: "G3056", extended: null });
    expect(parseStrongs("3056")).toEqual({ base: "G3056", extended: null });
    expect(parseStrongs("g846")).toEqual({ base: "G0846", extended: null });
    expect(parseStrongs("G2491g")).toEqual({ base: "G2491", extended: "G2491G" });
    expect(parseStrongs("logos")).toBeNull();
  });
});

describe("normalizeLatin", () => {
  it("folds transliteration diacritics", () => {
    expect(normalizeLatin("archē")).toBe("arce");
    expect(normalizeLatin("Iōannēs")).toBe("ioannes");
    expect(normalizeLatin("Egeneto")).toBe(normalizeLatin("egenetō"));
  });
  it("ignores h so breathing spellings coincide", () => {
    expect(normalizeLatin("ohutos")).toBe(normalizeLatin("houtos"));
    expect(normalizeLatin("Christos")).toBe(normalizeLatin("cristos"));
  });
});
