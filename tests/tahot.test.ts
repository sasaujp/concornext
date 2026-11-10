import { describe, expect, it } from "vitest";
import { isImported, joinSegments, parseKetiv, parseTahotLine, parseTbeshLine, rootSegments } from "../scripts/tahot";

// TAHOT rows have 17 tab-separated columns:
// ref, Hebrew, transliteration, translation, dStrongs, grammar, meaning variants, spelling variants,
// root dStrong+instance, alternative Strongs, conjoin word, expanded Strong tags, …
const row = (cols: string[]) => [...cols, ...Array(17 - cols.length).fill("")].join("\t");

describe("parseTahotLine", () => {
  it("splits prefixes, the root word and trailing punctuation", () => {
    const t = parseTahotLine(
      row(["Gen.1.1#07=L", "הָ/אָֽרֶץ\\׃", "ha./'A.retz", "the/ earth", "H9009/{H0776G}\\H9016", "HTd/Ncfsa", "", "", "H0776G"]),
    );
    expect(t).toMatchObject({
      book: "Gen",
      chapter: 1,
      verse: 1,
      engChapter: 1,
      engVerse: 1,
      wordNo: "07",
      sortKey: 700,
      source: "L",
      language: "hbo",
      surface: "הָאָֽרֶץ׃",
      transliteration: "ha.'A.retz",
      english: "the/ earth",
      ketiv: null,
      instance: "H0776G",
    });
    expect(t!.segments).toEqual([
      { kind: "affix", hebrew: "הָ", transliteration: "ha.", strongs: "H9009", morph: "HTd", continuesNext: false, trailing: "" },
      { kind: "root", hebrew: "אָֽרֶץ", transliteration: "'A.retz", strongs: "H0776G", morph: "HNcfsa", continuesNext: false, trailing: "׃" },
    ]);
    expect(rootSegments(t!).map(s => s.strongs)).toEqual(["H0776G"]);
  });

  it("uses the Hebrew (MT) verse and keeps the English one", () => {
    const t = parseTahotLine(row(["Psa.51.0(51.1)#02=L", "מִזְמ֥וֹר", "miz.Mor", "a psalm", "{H4210}", "HNcmsa"]));
    expect(t).toMatchObject({ book: "Psa", chapter: 51, verse: 1, engChapter: 51, engVerse: 0 });
    const t2 = parseTahotLine(row(["Mal.4.1(3.19)#01=L", "כִּֽי\\־", "ki-", "for", "{H3588A}\\H9014", "HTc"]));
    expect(t2).toMatchObject({ book: "Mal", chapter: 3, verse: 19, engChapter: 4, engVerse: 1, surface: "כִּֽי־" });
  });

  it("parses books whose code starts with a digit", () => {
    const t = parseTahotLine(row(["1Sa.1.1#01=L", "וַֽ/יְהִי\\־", "vai./hi-", "and/ he was", "H9001/{H1961}\\H9014", "HC/Vqw3ms"]));
    expect(t).toMatchObject({ book: "1Sa", chapter: 1, verse: 1 });
    expect(t!.segments.map(s => s.kind)).toEqual(["affix", "root"]);
  });

  it("marks Aramaic words", () => {
    const t = parseTahotLine(row(["Dan.2.4#08=L", "דִּ֖י", "di", "which", "{H1768}", "ATr"]));
    expect(t).toMatchObject({ language: "arc" });
    expect(t!.segments[0].morph).toBe("ATr");
  });

  it("reads the Ketiv of a Qere word whose meaning differs", () => {
    const t = parseTahotLine(
      row([
        "Gen.9.21#07=Q(K)",
        "אָהֳלֽ/וֹ\\׃",
        "'o.ho.L/o",
        "tent/ his",
        "{H0168G}/H9023\\H9016",
        "HNcmsc/Sp3ms",
        "K= 'o.ho.Lo/h (אָהֳלֹ/ה\\׃) \"tent/ his\" (H0168G/H9023\\H9016=HNcbsc/Sp3ms)",
        "L= אָהֳלֹֽ/ה\\׃ ¦ ;",
      ]),
    );
    expect(t).toMatchObject({ source: "Q", wordType: "Q(K)", surface: "אָהֳלֽוֹ׃", ketiv: "אָהֳלֹה׃", ketivGloss: "tent/ his" });
  });

  it("reads the Ketiv of a Qere word from the spelling variants", () => {
    expect(parseKetiv("", "L= הַוְצֵ֣א ¦ ;K= הוֹצֵא")).toEqual({ ketiv: "הוֹצֵא", gloss: null });
  });

  it("handles two Hebrew words in one row (Qere of two words)", () => {
    const t = parseTahotLine(row(["Gen.30.11#03=Q(K)", "בָּ֣א//גָ֑ד", "be.//gad", "has come// good fortune", "{H0935G}//{H1409}", "HVqp3ms//Ncmsa"]));
    expect(t!.surface).toBe("בָּ֣א גָ֑ד");
    expect(t!.segments.map(s => [s.kind, s.strongs])).toEqual([
      ["root", "H0935G"],
      ["separator", null],
      ["root", "H1409"],
    ]);
  });

  it("flags a tag that also covers the next word, and section marks after sof pasuq", () => {
    const t = parseTahotLine(
      row(["Num.7.59#17=L(AH+B)", "פְּדָה/ /צֽוּר\\׃\\ \\פ", "pe.dah/ /tzur", "Pedahzur", "{H6301}+/ /{H6301}\\H9016\\ \\H9017", "HNpm//Npm"]),
    );
    expect(t!.surface).toBe("פְּדָה צֽוּר׃ פ");
    expect(t!.segments[0]).toMatchObject({ kind: "root", strongs: "H6301", continuesNext: true });
    expect(t!.segments[1]).toMatchObject({ kind: "separator", hebrew: " " });
    expect(t!.segments[2]).toMatchObject({ kind: "root", strongs: "H6301", trailing: "׃ פ" });
  });

  it("treats a maqqef between words as punctuation", () => {
    const t = parseTahotLine(row(["Exo.4.2#04=Q(K)", "מַה/־/זֶּ֣ה", "mah/-/zeh-", "what/-/ this", "{H4100}/H9014/{H2088}", "HPi//Tm"]));
    expect(t!.segments.map(s => [s.kind, s.morph])).toEqual([
      ["root", "HPi"],
      ["punctuation", null],
      ["root", "HTm"],
    ]);
  });

  it("orders inserted words after the word they follow", () => {
    const a = parseTahotLine(row(["Gen.4.8#05=L", "אָחִ֑י/ו", "'a.Chi/v", "brother/ his", "{H0251G}/H9023", "HNcmsc/Sp3ms"]))!;
    const x = parseTahotLine(row(["Gen.4.8#0501=X", "נֵלְכָה", "ne.le.Khah", "let us go", "{H1980G}", "HVqi1cp"]))!;
    const b = parseTahotLine(row(["Gen.4.8#06=L", "הַ/שָּׂדֶ֑ה", "ha./sa.Deh", "the/ field", "H9009/{H7704G}", "HTd/Ncbsa"]))!;
    expect(a.sortKey < x.sortKey && x.sortKey < b.sortKey).toBe(true);
    expect(isImported(x)).toBe(false);
    expect(isImported(a)).toBe(true);
  });

  it("skips a Ketiv that is not read (empty Qere row)", () => {
    const t = parseTahotLine(row(["Isa.44.24#16=Q(K)", "", "[ ]", "", "", "", "K= mi (מִי) \"who [was]?\" (H4310=HPi)", "L= מֵי ¦ ;"]));
    expect(t).toMatchObject({ surface: "", segments: [], language: null, ketiv: "מִי" });
    expect(isImported(t!)).toBe(false);
  });

  it("keeps restored text", () => {
    const t = parseTahotLine(row(["Jos.21.36#01=R", "וּ/מִ/מַּטֵּ֣ה", "u./mi./ma.Teh", "and/ from/ [the] tribe of", "H9002/H9006/{H4294H}", "HC/R/Ncmsc"]));
    expect(t).toMatchObject({ source: "R" });
    expect(isImported(t!)).toBe(true);
  });

  it("ignores non-data lines", () => {
    expect(parseTahotLine("# Gen.1.1\tbe.re.Shit (בְּרֵאשִׁ֖ית)")).toBeNull();
    expect(parseTahotLine("#_Translation\tin/ beginning")).toBeNull();
    expect(parseTahotLine("Eng (Heb) Ref & Type\tHebrew\tTransliteration")).toBeNull();
  });
});

describe("joinSegments", () => {
  it("removes segment markers and turns // into a space", () => {
    expect(joinSegments("בְּ/רֵאשִׁ֖ית")).toBe("בְּרֵאשִׁ֖ית");
    expect(joinSegments("עַל\\־")).toBe("עַל־");
    expect(joinSegments("אֵ֥שׁ//דָּ֖ת")).toBe("אֵ֥שׁ דָּ֖ת");
  });
});

describe("parseTbeshLine", () => {
  it("reads the lexicon entry without the Meaning column", () => {
    const e = parseTbeshLine(
      ["H1254a", "H1254A =", "H1254A", "בָּרָא", "ba.ra", "H:V", "to create", "1) to create, shape, form<br>…"].join("\t"),
    );
    expect(e).toEqual({ eStrong: "H1254a", strongs: "H1254A", uStrong: "H1254A", hebrew: "בָּרָא", transliteration: "ba.ra", pos: "H:V", gloss: "to create" });
    expect(Object.values(e!)).not.toContain("1) to create, shape, form<br>…");
  });

  it("reads disambiguated entries that point to another word", () => {
    const e = parseTbeshLine(["H0430", "H0430H = a Part of", "H3068G", "אֱלֹהִים", "e.lo.him", "H:N-M", "(LORD)-Elohe", "…"].join("\t"));
    expect(e).toMatchObject({ eStrong: "H0430", strongs: "H0430H", uStrong: "H3068G", gloss: "(LORD)-Elohe" });
  });

  it("ignores header lines", () => {
    expect(parseTbeshLine("TBESH - Translators Brief lexicon of Extended Strongs for Hebrew")).toBeNull();
    expect(parseTbeshLine("\t==========")).toBeNull();
  });
});
