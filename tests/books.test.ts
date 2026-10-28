import { describe, expect, it } from "vitest";
import { CHAPTER_END, displayPassage, findBook, formatPassage, parsePassage } from "~/lib/books";

describe("findBook", () => {
  it("accepts codes, English and Japanese names and prefixes", () => {
    expect(findBook("Jhn")?.code).toBe("Jhn");
    expect(findBook("john")?.code).toBe("Jhn");
    expect(findBook("ヨハネ")?.code).toBe("Jhn");
    expect(findBook("1 Corinthians")?.code).toBe("1Co");
    expect(findBook("1Cor")?.code).toBe("1Co");
    expect(findBook("Ⅰコリント")?.code).toBe("1Co");
    expect(findBook("1コリント")?.code).toBe("1Co");
    expect(findBook("Matt")?.code).toBe("Mat");
    expect(findBook("Ph")).toBeUndefined(); // Philippians / Philemon
  });
});

describe("parsePassage", () => {
  const parse = (s: string) => {
    const p = parsePassage(s);
    return p && { book: p.book.code, from: p.from, to: p.to };
  };
  it("parses verse ranges", () => {
    expect(parse("Jhn.1.1-18")).toEqual({ book: "Jhn", from: { chapter: 1, verse: 1 }, to: { chapter: 1, verse: 18 } });
    expect(parse("ヨハネ 1:1-18")).toEqual(parse("Jhn.1.1-18"));
    expect(parse("ヨハネ１：１〜１８")).toEqual(parse("Jhn.1.1-18"));
    expect(parse("John 1:1–2:11")).toEqual({ book: "Jhn", from: { chapter: 1, verse: 1 }, to: { chapter: 2, verse: 11 } });
    expect(parse("1jn1:5")).toEqual({ book: "1Jn", from: { chapter: 1, verse: 5 }, to: { chapter: 1, verse: 5 } });
  });
  it("parses whole chapters", () => {
    expect(parse("1コリント 13")).toEqual({ book: "1Co", from: { chapter: 13, verse: 1 }, to: { chapter: 13, verse: CHAPTER_END } });
    expect(parse("Mat 5-7")).toEqual({ book: "Mat", from: { chapter: 5, verse: 1 }, to: { chapter: 7, verse: CHAPTER_END } });
  });
  it("rejects bad input", () => {
    expect(parsePassage("")).toBeNull();
    expect(parsePassage("Foo 1:1")).toBeNull();
    expect(parsePassage("Jhn 2:1-1:5")).toBeNull();
    expect(parsePassage("Jhn 0")).toBeNull();
  });
  it("round-trips through the canonical form", () => {
    for (const s of ["Jhn.1.1-18", "Jhn.1.1-2.11", "Jhn.1", "Mat.5-7", "Rom.8.28"]) expect(formatPassage(parsePassage(s)!)).toBe(s);
  });
  it("displays in Japanese", () => {
    expect(displayPassage(parsePassage("Jhn.1.1-18")!)).toBe("ヨハネ 1:1–18");
    expect(displayPassage(parsePassage("Mat.5-7")!)).toBe("マタイ 5–7章");
  });
});
