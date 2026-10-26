/**
 * Builds SQL import files for D1 from the STEPBible raw files in data/raw/.
 *
 *   pnpm data:build
 *
 * Output: data/sql/*.sql (applied in lexical order by scripts/apply-import.ts).
 * The first file clears the data tables, so the whole import is re-runnable.
 * Only words that belong to the NA28 text (edition list contains NA28) are imported.
 */
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { normalizeGreek, normalizeLatin, stripPunctuation } from "../src/lib/greek";
import { isNA28, parseTagntLine, parseTbesgLine, strongsBase, type TagntToken, type TbesgEntry } from "./tagnt";

const RAW = join(process.cwd(), "data", "raw");
const OUT = join(process.cwd(), "data", "sql");
const ROWS_PER_STATEMENT = 100;
const STATEMENTS_PER_FILE = 150;

/** Stable lemma ID derived from the extended Strong's number (G3056 → 91680, G2491G → 74737). */
export function lemmaIdFor(strongs: string): number {
  const m = strongs.match(/^G(\d+)([A-Z]?)$/);
  if (!m) throw new Error(`Bad Strong's number ${strongs}`);
  return Number(m[1]) * 30 + (m[2] ? m[2].charCodeAt(0) - 64 : 0);
}

function q(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

async function readLines(file: string, fn: (line: string) => void) {
  const rl = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) fn(line.replace(/^﻿/, ""));
}

interface OccRow {
  lemmaId: number;
  token: TagntToken;
  part: number;
  morph: string;
}

async function main() {
  const version = JSON.parse(await readFile(join(RAW, "VERSION.json"), "utf8").catch(() => '{"sha":"unknown"}'));

  // --- TBESG lexicon
  const lexicon = new Map<string, TbesgEntry>();
  const lexiconByBase = new Map<string, TbesgEntry>();
  await readLines(join(RAW, "TBESG.txt"), line => {
    const e = parseTbesgLine(line);
    if (!e) return;
    if (!lexicon.has(e.strongs)) lexicon.set(e.strongs, e);
    if (!lexiconByBase.has(e.base)) lexiconByBase.set(e.base, e);
  });
  console.log(`TBESG entries: ${lexicon.size}`);

  // --- TAGNT tokens (NA28 only)
  const occurrences: OccRow[] = [];
  // TAGNT "dictionary form" per Strong's number, with frequencies (single-lemma tokens only).
  const dictForms = new Map<string, Map<string, number>>();
  let total = 0;
  let skipped = 0;
  const seen = new Set<string>();
  for (const f of ["TAGNT_Mat-Jhn.txt", "TAGNT_Act-Rev.txt"]) {
    await readLines(join(RAW, f), line => {
      const t = parseTagntLine(line);
      if (!t) return;
      total++;
      if (!isNA28(t)) {
        skipped++;
        return;
      }
      const key = `${t.bookOrd}.${t.chapter}.${t.verse}#${t.position}`;
      if (seen.has(key)) throw new Error(`Duplicate token ${key}`);
      seen.add(key);
      if (t.parts.length === 0) throw new Error(`No Strong's for ${key}: ${line.slice(0, 120)}`);
      t.parts.forEach((p, i) => {
        if (t.parts.length === 1 && t.dictionaryForm) {
          const m = dictForms.get(p.strongs) ?? new Map<string, number>();
          m.set(t.dictionaryForm, (m.get(t.dictionaryForm) ?? 0) + 1);
          dictForms.set(p.strongs, m);
        }
        occurrences.push({ lemmaId: lemmaIdFor(p.strongs), token: t, part: i, morph: p.morph });
      });
    });
  }
  console.log(`TAGNT rows: ${total}, NA28 tokens: ${seen.size}, non-NA28 skipped: ${skipped}, occurrence rows: ${occurrences.length}`);

  // --- Lemmas
  const lemmaStats = new Map<number, { strongs: string; count: number; verses: Set<string> }>();
  const strongsById = new Map<number, string>();
  for (const o of occurrences) {
    const p = o.token.parts[o.part];
    strongsById.set(o.lemmaId, p.strongs);
    let s = lemmaStats.get(o.lemmaId);
    if (!s) lemmaStats.set(o.lemmaId, (s = { strongs: p.strongs, count: 0, verses: new Set() }));
    s.count++;
    s.verses.add(`${o.token.bookOrd}.${o.token.chapter}.${o.token.verse}`);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const files: string[] = [];
  let fileNo = 0;
  async function emit(name: string, statements: string[]) {
    for (let i = 0; i < statements.length || i === 0; i += STATEMENTS_PER_FILE) {
      const chunk = statements.slice(i, i + STATEMENTS_PER_FILE);
      const fname = `${String(fileNo++).padStart(3, "0")}_${name}.sql`;
      await writeFile(join(OUT, fname), chunk.join("\n") + "\n");
      files.push(fname);
    }
  }
  function inserts(table: string, cols: string[], rows: (string | number | null)[][]): string[] {
    const out: string[] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
      const values = rows
        .slice(i, i + ROWS_PER_STATEMENT)
        .map(r => `(${r.map(q).join(",")})`)
        .join(",\n");
      out.push(`INSERT INTO ${table} (${cols.join(",")}) VALUES\n${values};`);
    }
    return out;
  }

  await emit("reset", [
    "DELETE FROM occurrences;",
    "DELETE FROM lemma_definitions;",
    "DELETE FROM lemmas;",
    "DELETE FROM data_versions WHERE source = 'STEPBible-Data';",
  ]);

  const missingLex: string[] = [];
  const lemmaRows: (string | number | null)[][] = [];
  const defRows: (string | number | null)[][] = [];
  for (const [id, s] of [...lemmaStats].sort((a, b) => a[0] - b[0])) {
    // Exact extended Strong's first; otherwise the first TBESG entry filed under the plain number
    // (TAGNT sometimes tags e.g. G2453 where TBESG only has G2453G).
    const lex = lexicon.get(s.strongs) ?? lexiconByBase.get(strongsBase(s.strongs));
    if (!lexicon.has(s.strongs)) missingLex.push(`${s.strongs}${lex ? `→${lex.strongs}` : "(none)"}`);
    const tagntForms = dictForms.get(s.strongs);
    const tagntLemma = tagntForms ? [...tagntForms].sort((a, b) => b[1] - a[1])[0][0].split(",")[0].trim() : null;
    const greek = lex?.greek || tagntLemma || s.strongs;
    // TAGNT sometimes files a Strong's number under a different headword (G3165 μέ → ἐγώ); keep it as an alias.
    const alt = tagntLemma && normalizeGreek(tagntLemma) !== normalizeGreek(greek.split(",")[0]) ? tagntLemma : null;
    lemmaRows.push([
      id,
      s.strongs,
      strongsBase(s.strongs),
      greek,
      normalizeGreek(greek),
      alt,
      alt ? normalizeGreek(alt) : null,
      lex?.transliteration ?? null,
      lex?.transliteration ? normalizeLatin(lex.transliteration) : null,
      lex?.gloss ?? null,
      lex?.pos ?? null,
      s.count,
      s.verses.size,
    ]);
    if (lex?.definition) defRows.push([id, lex.definition]);
  }
  if (missingLex.length) console.warn(`Lemmas without exact TBESG entry (${missingLex.length}): ${missingLex.join(" ")}`);
  console.log(`Lemmas: ${lemmaRows.length}`);

  await emit(
    "lemmas",
    inserts(
      "lemmas",
      ["id", "strongs_id", "strongs_base", "greek_lemma", "lemma_plain", "alt_lemma", "alt_lemma_plain", "transliteration", "translit_plain", "gloss", "lex_pos", "occurrence_count", "verse_count"],
      lemmaRows,
    ),
  );
  // Definitions are long HTML; keep statements small.
  const defStatements: string[] = [];
  for (let i = 0; i < defRows.length; i += 10) {
    defStatements.push(
      `INSERT INTO lemma_definitions (lemma_id, definition_html) VALUES\n${defRows
        .slice(i, i + 10)
        .map(r => `(${r.map(q).join(",")})`)
        .join(",\n")};`,
    );
  }
  await emit("definitions", defStatements);

  let occId = 1;
  const occRows = occurrences.map(o => {
    const t = o.token;
    return [
      occId++,
      o.lemmaId,
      t.bookOrd,
      t.book,
      t.chapter,
      t.verse,
      t.position,
      o.part,
      t.surface,
      normalizeGreek(stripPunctuation(t.surface)),
      t.transliteration,
      t.transliteration ? normalizeLatin(t.transliteration) : null,
      t.english,
      o.morph,
      t.wordType,
      t.editions,
      t.instance,
    ];
  });
  await emit(
    "occurrences",
    inserts(
      "occurrences",
      ["id", "lemma_id", "book_ord", "book", "chapter", "verse", "token_position", "part", "surface_form", "surface_plain", "transliteration", "translit_plain", "english_gloss", "morphology_code", "word_type", "edition_info", "instance"],
      occRows,
    ),
  );

  const detail = JSON.stringify({
    commitDate: version.commitDate ?? null,
    filter: "edition contains NA28",
    tokens: seen.size,
    occurrenceRows: occurrences.length,
    lemmas: lemmaRows.length,
  });
  await emit("version", [
    `INSERT INTO data_versions (source, version, detail, imported_at) VALUES (${q("STEPBible-Data")}, ${q(version.sha)}, ${q(detail)}, ${q(new Date().toISOString())});`,
  ]);

  await writeFile(join(OUT, "manifest.json"), JSON.stringify({ version: version.sha, files }, null, 2) + "\n");
  console.log(`Wrote ${files.length} SQL files to data/sql/`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
