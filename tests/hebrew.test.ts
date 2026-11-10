import { describe, expect, it } from "vitest";
import { containsHebrew, HEBREW_ALPHABET, normalizeHebrew, stripHebrewPunctuation } from "~/lib/hebrew";

describe("normalizeHebrew", () => {
  it("keeps consonants only and folds final forms", () => {
    expect(normalizeHebrew("בְּרֵאשִׁ֖ית")).toBe("בראשית");
    expect(normalizeHebrew("הָאָֽרֶץ׃")).toBe("הארצ");
    expect(normalizeHebrew("מֶ֫לֶךְ")).toBe("מלכ");
    expect(normalizeHebrew("עַל־")).toBe("על");
    expect(normalizeHebrew("שָׁלוֹם")).toBe(normalizeHebrew("שלום"));
  });
});

describe("stripHebrewPunctuation", () => {
  it("removes maqqef, sof pasuq, paseq and trailing section marks", () => {
    expect(stripHebrewPunctuation("הָאָֽרֶץ׃")).toBe("הָאָֽרֶץ");
    expect(stripHebrewPunctuation("עַל־")).toBe("עַל");
    expect(stripHebrewPunctuation("צֽוּר׃ פ")).toBe("צֽוּר");
  });
});

describe("misc", () => {
  it("detects Hebrew and lists the alphabet", () => {
    expect(containsHebrew("logos")).toBe(false);
    expect(containsHebrew("בָּרָא")).toBe(true);
    expect(HEBREW_ALPHABET).toHaveLength(22);
  });
});
