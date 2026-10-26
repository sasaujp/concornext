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
