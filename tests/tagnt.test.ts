import { describe, expect, it } from "vitest";
import { isNA28, na28Displacement, parseTagntLine, parseTbesgLine } from "../scripts/tagnt";

const T = "\t";
const line = (cols: string[]) => cols.join(T);

describe("parseTagntLine", () => {
  it("parses a TAGNT word row", () => {
    const t = parseTagntLine(
      line(["Jhn.1.6#01=NKO", "Ἐγένετο (Egeneto)", "There came", "G1096=V-2ADI-3S", "γίνομαι=to be", "NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz", "", "", "Llegó a ser", "to be", "#01", "G1096", ""]),
    );
    expect(t).toMatchObject({
      book: "Jhn",
      bookOrd: 4,
      chapter: 1,
      verse: 6,
      position: 1,
      wordType: "NKO",
      surface: "Ἐγένετο",
      transliteration: "Egeneto",
      parts: [{ strongs: "G1096", morph: "V-2ADI-3S" }],
      dictionaryForm: "γίνομαι",
    });
    expect(isNA28(t!)).toBe(true);
  });

  it("parses crasis into component lemmas", () => {
    const t = parseTagntLine(
      line(["Act.5.37#18=NKO", "κἀκεῖνος (kakeinos)", "And he", "G2532=CONJ + G1565=D-NSM", "κἀκεῖνος=and that one", "NA28+NA27", "", "", "", "", "", "G1565, G2532_B", ""]),
    );
    expect(t!.parts).toEqual([
      { strongs: "G2532", morph: "CONJ" },
      { strongs: "G1565", morph: "D-NSM" },
    ]);
  });

  it("handles alternative versification in brackets", () => {
    const t = parseTagntLine(line(["Act.2.11[2.10]#01=NKO", "Ἰουδαῖοί (Ioudaioi)", "Jews", "G2453=N-NPM-PG", "Ἰουδαῖος=Jewish", "NA28+TR"]));
    expect(t).toMatchObject({ book: "Act", chapter: 2, verse: 11, position: 1 });
  });

  it("ignores non-data lines", () => {
    expect(parseTagntLine("# Jhn.1.1\tἘν\tἀρχῇ")).toBeNull();
    expect(parseTagntLine("Word & Type\tGreek")).toBeNull();
  });
});

describe("edition filtering", () => {
  it("keeps NA28 words and skips TR/Byz-only words", () => {
    expect(isNA28({ editions: "NA28+NA27+Tyn+SBL+WH+Treg" })).toBe(true);
    expect(isNA28({ editions: "TR+Byz" })).toBe(false);
    expect(isNA28({ editions: "NA27+Tyn+SBL+WH+Treg" })).toBe(false);
    expect(isNA28({ editions: "NA28«2+NA27+Tyn" })).toBe(true);
    expect(na28Displacement({ editions: "NA28«2+NA27+Tyn" })).toBe("«2");
    expect(na28Displacement({ editions: "NA28+NA27" })).toBeNull();
  });
});

describe("parseTbesgLine", () => {
  it("reads the extended Strong's entry", () => {
    const e = parseTbesgLine(line(["G2491", "G2491G =", "G2491G", "Ἰωάννης", "Iōannēs", "N:N-M-P", "John", "<b>Ἰωάνης</b> …"]));
    expect(e).toMatchObject({ base: "G2491", strongs: "G2491G", greek: "Ἰωάννης", gloss: "John" });
  });
});
