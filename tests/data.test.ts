/**
 * Acceptance checks against the real STEPBible data in the local D1 database
 * (run `pnpm db:migrate:local && pnpm data:import:local` first).
 * Uses `wrangler d1 execute --local`, so it exercises the same SQLite data the app reads.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { decodeMorphology } from "~/lib/morph";
import { normalizeGreek, normalizeLatin } from "~/lib/greek";

function d1<T = Record<string, unknown>>(sql: string): T[] {
  const out = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "concornext", "--local", "--json", "--command", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return (JSON.parse(out) as { results: T[] }[])[0].results;
}

let available = false;
try {
  available = Number(d1<{ n: number }>("SELECT count(*) AS n FROM occurrences")[0].n) > 100000;
} catch {
  available = false;
}

describe.skipIf(!available)("STEPBible data in local D1", () => {
  it("finds λόγος by accent-insensitive search and lists John 1:1", () => {
    const [lemma] = d1<{ id: number; strongs_id: string }>(`SELECT id, strongs_id FROM lemmas WHERE lemma_plain = '${normalizeGreek("λογος")}'`);
    expect(lemma.strongs_id).toBe("G3056");
    const hits = d1<{ token_position: number }>(
      `SELECT token_position FROM occurrences WHERE lemma_id = ${lemma.id} AND book = 'Jhn' AND chapter = 1 AND verse = 1 ORDER BY token_position`,
    );
    // Ἐν ἀρχῇ ἦν ὁ λόγος(5), καὶ ὁ λόγος(8) ἦν πρὸς τὸν θεόν, καὶ θεὸς ἦν ὁ λόγος(17).
    expect(hits.map(h => h.token_position)).toEqual([5, 8, 17]);
  });

  it("distinguishes occurrences from verses (multiple occurrences in one verse)", () => {
    const [l] = d1<{ occurrence_count: number; verse_count: number }>(`SELECT occurrence_count, verse_count FROM lemmas WHERE strongs_id = 'G3056'`);
    expect(l.occurrence_count).toBe(330);
    expect(l.verse_count).toBe(317);
    const [c] = d1<{ occ: number; verses: number }>(
      `SELECT count(*) AS occ, count(DISTINCT book_ord * 1000000 + chapter * 1000 + verse) AS verses FROM occurrences o JOIN lemmas l ON l.id = o.lemma_id WHERE l.strongs_id = 'G3056'`,
    );
    expect(c).toEqual({ occ: 330, verses: 317 });
  });

  it("tags ἐγένετο in John 1:6 as an aorist and ἀπεσταλμένος as not", () => {
    const rows = d1<{ token_position: number; surface_form: string; morphology_code: string; strongs_id: string }>(
      `SELECT o.token_position, o.surface_form, o.morphology_code, l.strongs_id FROM occurrences o JOIN lemmas l ON l.id = o.lemma_id WHERE book = 'Jhn' AND chapter = 1 AND verse = 6 ORDER BY token_position`,
    );
    const egeneto = rows.find(r => r.token_position === 1)!;
    // Polytonic accents may be stored as oxia (U+1F71…) or tonos; compare canonically.
    expect(egeneto.surface_form.normalize("NFC")).toBe("Ἐγένετο".normalize("NFC"));
    expect(egeneto.strongs_id).toBe("G1096");
    expect(decodeMorphology(egeneto.morphology_code).isAorist).toBe(true);
    const aorists = rows.filter(r => decodeMorphology(r.morphology_code).isAorist).map(r => r.token_position);
    expect(aorists).toEqual([1]);
  });

  it("John 1:1 contains no aorist (ἦν is imperfect)", () => {
    const rows = d1<{ morphology_code: string }>(`SELECT morphology_code FROM occurrences WHERE book = 'Jhn' AND chapter = 1 AND verse = 1`);
    expect(rows.some(r => decodeMorphology(r.morphology_code).isAorist)).toBe(false);
  });

  it("keeps lemma counts consistent with occurrence rows and records the data version", () => {
    const [s] = d1<{ a: number; b: number }>(`SELECT (SELECT sum(occurrence_count) FROM lemmas) AS a, (SELECT count(*) FROM occurrences) AS b`);
    expect(s.a).toBe(s.b);
    const [v] = d1<{ version: string }>(`SELECT version FROM data_versions WHERE source = 'STEPBible-Data'`);
    expect(v.version).toMatch(/^[0-9a-f]{40}$/);
  });

  it("only imports NA28 words", () => {
    const [r] = d1<{ n: number }>(`SELECT count(*) AS n FROM occurrences WHERE edition_info NOT LIKE '%NA28%'`);
    expect(r.n).toBe(0);
  });
});

describe.skipIf(!available)("transliteration search keys", () => {
  const lemmasFor = (form: string) =>
    d1<{ strongs_id: string }>(
      `SELECT DISTINCT l.strongs_id FROM occurrences o JOIN lemmas l ON l.id = o.lemma_id WHERE o.translit_plain = '${normalizeLatin(form)}' ORDER BY l.strongs_id`,
    ).map(r => r.strongs_id);

  it("finds γίνομαι from the inflected form 'egeneto'", () => {
    expect(lemmasFor("egeneto")).toContain("G1096");
  });

  it("finds καταλαμβάνω from 'katelaben' and σκηνόω from 'eskēnōsen'", () => {
    expect(lemmasFor("katelaben")).toContain("G2638");
    expect(lemmasFor("eskēnōsen")).toContain("G4637");
  });

  it("matches οὗτος with or without the breathing h", () => {
    const [l] = d1<{ translit_plain: string }>(`SELECT translit_plain FROM lemmas WHERE strongs_id = 'G3778'`);
    expect(l.translit_plain).toBe(normalizeLatin("houtos"));
  });
});

describe.skipIf(!available)("lemma memos", () => {
  it("seeds the sample notebook locations and keys them by Strong's number", () => {
    const rows = d1<{ strongs_id: string; note: string }>(
      `SELECT n.strongs_id, n.note FROM lemma_notes n JOIN lemmas l ON l.strongs_id = n.strongs_id WHERE n.strongs_id IN ('G3056','G2638','G4637','G3439','G1834','G4592') ORDER BY n.strongs_id`,
    );
    expect(rows.length).toBe(6);
    expect(rows.find(r => r.strongs_id === "G3056")?.note).toBe("ノート1巻 p.4-7");
  });
});
