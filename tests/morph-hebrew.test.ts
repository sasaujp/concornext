import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeHebrewMorphology, isHebrewMorphology, summarizeHebrewMorphology } from "~/lib/morph-hebrew";

const sum = (code: string) => summarizeHebrewMorphology(decodeHebrewMorphology(code));

describe("decodeHebrewMorphology", () => {
  it("decodes verbs", () => {
    expect(sum("HVqp3ms")).toBe("動詞 Qal 完了 3人称 男性 単数");
    expect(sum("HVqw3ms")).toBe("動詞 Qal ワイイクトル（継続未完了） 3人称 男性 単数");
    expect(sum("HVhv2ms")).toBe("動詞 Hiphil 命令形 2人称 男性 単数");
    expect(sum("HVprmsa")).toBe("動詞 Piel 分詞 男性 単数 絶対形");
    expect(sum("HVqc1cs")).toBe("動詞 Qal 未完了（願望形） 1人称 通性 単数");
    expect(sum("HVqcc")).toBe("動詞 Qal 不定詞連語形 連語形");
    expect(sum("HVqaa")).toBe("動詞 Qal 不定詞独立形 絶対形");
    expect(sum("AVqp3ms")).toBe("アラム語 動詞 Peal 完了 3人称 男性 単数");
  });

  it("decodes nouns, names, pronouns, suffixes and particles", () => {
    expect(sum("HNcfsa")).toBe("名詞 普通名詞 女性 単数 絶対形");
    expect(sum("HNpm")).toBe("名詞 固有名詞 男性");
    expect(sum("HNpl")).toBe("名詞 固有名詞 地名");
    expect(sum("HSp3ms")).toBe("接尾辞 人称接尾辞 3人称 男性 単数");
    expect(sum("HTd")).toBe("不変化詞 冠詞");
    expect(sum("HTo")).toBe("不変化詞 目的語標識");
    expect(sum("HRd")).toBe("前置詞 冠詞付き");
    expect(sum("Hc")).toBe("接続詞 ワイイクトルのワウ");
    expect(sum("ATr")).toBe("アラム語 不変化詞 関係");
  });

  it("tells Hebrew codes from Greek (Robinson) codes", () => {
    expect(isHebrewMorphology("HVqp3ms")).toBe(true);
    expect(isHebrewMorphology("Hc")).toBe(true);
    expect(isHebrewMorphology("V-2ADI-3S")).toBe(false);
    expect(isHebrewMorphology("N-NSM")).toBe(false);
  });
});

// Every code that occurs in TAHOT, checked against TEHMC's own expansion (needs `pnpm data:download`).
const RAW = join(process.cwd(), "data", "raw");
const available = existsSync(join(RAW, "TEHMC.txt")) && existsSync(join(RAW, "TAHOT_Gen-Deu.txt"));

describe.skipIf(!available)("agreement with TEHMC", () => {
  it("matches TEHMC for every code used in TAHOT", () => {
    const tehmc = new Map<string, Record<string, string>>();
    for (const line of readFileSync(join(RAW, "TEHMC.txt"), "utf8").split("\n")) {
      const [code, desc] = line.split("\t");
      if (!/^[HA][A-Z]\S*$/.test(code ?? "") || !desc) continue;
      const fields: Record<string, string> = {};
      for (const kv of desc.split(/\s*;\s*/)) {
        const i = kv.indexOf("=");
        if (i > 0) fields[kv.slice(0, i).trim()] = kv.slice(i + 1).replace(/\s*\(.*$/, "").trim();
      }
      tehmc.set(code, fields);
    }
    const used = new Set<string>();
    for (const f of ["TAHOT_Gen-Deu.txt", "TAHOT_Jos-Est.txt", "TAHOT_Job-Sng.txt", "TAHOT_Isa-Mal.txt"]) {
      for (const line of readFileSync(join(RAW, f), "utf8").split("\n")) {
        const cols = line.split("\t");
        if (!/^[1-3]?[A-Za-z]{2,3}\.\d+\.\d+.*#/.test(cols[0] ?? "") || !cols[5]) continue;
        const g = cols[5].trim();
        for (const s of g.slice(1).split("/")) if (s) used.add(g[0] + s);
      }
    }
    // Known gaps in TEHMC itself: Hc (the vav of wayyiqtol) is not listed; AVvi3mp is called a perfect although
    // "i" is the imperfect; the Aramaic stem "P" is "Hitpeel" in AVPi… but "Pual" in AVPp…/AVPj… (Aramaic has no Pual).
    const known = new Set(["Hc", "AVvi3mp", "AVPp3ms", "AVPp3mp", "AVPj3mp"]);
    const mismatches: string[] = [];
    for (const code of used) {
      if (known.has(code)) continue;
      const t = tehmc.get(code);
      if (!t) {
        mismatches.push(`${code}: not in TEHMC`);
        continue;
      }
      const m = decodeHebrewMorphology(code).en;
      const verbish = !["Noun", "Adjective", "Pronoun", "Suffix", "Particle", "Preposition"].includes(m.function);
      const pairs: [string, string | undefined][] = [
        ["Function", m.function],
        ["Stem", m.stem],
        ["Person", m.person],
        ["Gender", m.gender],
        ["Number", m.number],
        ["State", m.state],
        ...(verbish ? ([["Form", m.form]] as [string, string | undefined][]) : []),
      ];
      for (const [k, mine] of pairs) if ((t[k] ?? "") !== (mine ?? "")) mismatches.push(`${code} ${k}: ${t[k]} ≠ ${mine}`);
    }
    expect(used.size).toBeGreaterThan(700);
    expect(mismatches).toEqual([]);
  });
});
