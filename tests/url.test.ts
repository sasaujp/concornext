import { describe, expect, it } from "vitest";
import { lexiconHref, readParams, safeReturnPath } from "~/lib/url";

describe("lexicon URL state", () => {
  it("defaults to alphabetical order with no letter filter", () => {
    expect(readParams({})).toMatchObject({ sort: "alpha", letter: null, page: 1 });
    expect(lexiconHref(readParams({}))).toBe("/");
  });

  it("round-trips sort, initial letter and selection", () => {
    const state = readParams({ sort: "freq", l: "λ", s: "G3056", book: "Jhn", cp: "2" });
    expect(state).toMatchObject({ sort: "freq", letter: "λ", s: "G3056", book: "Jhn", cp: 2 });
    expect(readParams(Object.fromEntries(new URLSearchParams(lexiconHref(state).slice(2))))).toEqual(state);
  });

  it("defaults to memo order when the memo filter is on", () => {
    expect(readParams({ memo: "1" }).sort).toBe("memo");
    expect(lexiconHref(readParams({ memo: "1" }))).toBe("/?memo=1");
    expect(readParams({ memo: "1", sort: "alpha" }).sort).toBe("alpha");
    expect(lexiconHref(readParams({ memo: "1", sort: "alpha" }))).toBe("/?sort=alpha&memo=1");
    // Memo order without the memo filter falls back to alphabetical.
    expect(readParams({ sort: "memo" }).sort).toBe("alpha");
  });

  it("ignores invalid letters", () => {
    expect(readParams({ l: "x" }).letter).toBeNull();
    expect(readParams({ l: "ς" }).letter).toBeNull();
  });

  it("only allows same-site return paths", () => {
    expect(safeReturnPath("/?s=G3056")).toBe("/?s=G3056");
    expect(safeReturnPath("//evil.example")).toBeNull();
    expect(safeReturnPath("https://evil.example")).toBeNull();
  });
});
