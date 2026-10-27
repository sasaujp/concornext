import { describe, expect, it } from "vitest";
import { compareNotes, type LemmaNote } from "~/server/lexicon";

const n = (note: string, book = "Jhn"): LemmaNote[] => [{ book, note }];

describe("compareNotes", () => {
  it("orders memo text naturally (numbers as numbers)", () => {
    const memos = ["ノート1巻 p.15-16", "ノート2巻 p.8-12", "ノート1巻 p.4-7", "ノート1巻 p.36", "ノート10巻 p.1"];
    const sorted = memos.map(m => n(m)).sort(compareNotes).map(x => x[0].note);
    expect(sorted).toEqual(["ノート1巻 p.4-7", "ノート1巻 p.15-16", "ノート1巻 p.36", "ノート2巻 p.8-12", "ノート10巻 p.1"]);
  });

  it("orders by book first when memos from several books are listed", () => {
    const sorted = [n("a", "Jhn"), n("b", "Mat"), n("c", "Rom")].sort(compareNotes).map(x => x[0].book);
    expect(sorted).toEqual(["Mat", "Jhn", "Rom"]);
  });
});
