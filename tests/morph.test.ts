import { describe, expect, it } from "vitest";
import { decodeMorphology, summarizeMorphology } from "~/lib/morph";

describe("decodeMorphology", () => {
  it("identifies ἐγένετο (Jhn 1:6, V-2ADI-3S) as a 2nd aorist", () => {
    const m = decodeMorphology("V-2ADI-3S");
    expect(m.isAorist).toBe(true);
    expect(m.tenseForm).toBe("second");
    expect(m.tense).toBe("第2アオリスト");
    expect(m.voice).toBe("中動態（デポーネント）");
    expect(m.mood).toBe("直説法");
    expect(m.person).toBe("3人称");
    expect(m.number).toBe("単数");
  });

  it("identifies 1st aorist active and passive forms", () => {
    expect(decodeMorphology("V-AAI-3S").isAorist).toBe(true);
    expect(decodeMorphology("V-AAI-3S").tenseForm).toBe("first");
    const p = decodeMorphology("V-APP-NSM");
    expect(p.isAorist).toBe(true);
    expect(p.voice).toBe("受動態");
    expect(p.mood).toBe("分詞");
    expect([p.case, p.number, p.gender]).toEqual(["主格", "単数", "男性"]);
    expect(decodeMorphology("V-2AAN").mood).toBe("不定詞");
    expect(decodeMorphology("V-AAS-2P").mood).toBe("接続法");
  });

  it.each([
    ["V-IAI-3S", "未完了過去"], // ἦν (Jhn 1:1)
    ["V-PAI-3S", "現在"],
    ["V-RPP-NSM", "完了"], // ἀπεσταλμένος (Jhn 1:6)
    ["V-LAI-3S", "過去完了"],
    ["V-FDI-3S", "未来"],
    ["V-2RAI-3S", "第2完了"],
  ])("does not mistake %s for an aorist", (code, tense) => {
    const m = decodeMorphology(code);
    expect(m.isAorist).toBe(false);
    expect(m.tense).toBe(tense);
  });

  it("does not treat non-verbs as aorist", () => {
    for (const code of ["N-NSM", "T-NSM", "A-NSM", "P-1GS", "CONJ", "PREP", "ADV", "N-NSM-P", "S-1SNSM", "F-3GSM"]) {
      expect(decodeMorphology(code).isAorist).toBe(false);
      expect(decodeMorphology(code).tense).toBeUndefined();
    }
  });

  it("decodes nominals, pronouns and suffixes", () => {
    expect(summarizeMorphology(decodeMorphology("N-NSM"))).toBe("名詞・主格・男性・単数");
    expect(decodeMorphology("P-1GS")).toMatchObject({ person: "1人称", case: "属格", number: "単数" });
    expect(decodeMorphology("N-ASM-T").extra).toContain("称号");
    expect(decodeMorphology("A-NSM-C").extra).toContain("比較級");
    expect(decodeMorphology("V-AAI-2S-ARAM")).toMatchObject({ isAorist: true, extra: ["アラム語"] });
  });
});
