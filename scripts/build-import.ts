/**
 * Builds SQL import files for D1 from the STEPBible raw files in data/raw/.
 *
 *   pnpm data:build
 *
 * Output: data/sql/*.sql (applied in lexical order by scripts/apply-import.ts).
 * The first file clears the data tables, so the whole import is re-runnable.
 *
 * - NT (TAGNT): only words that belong to the NA28 text (edition list contains NA28).
 * - OT (TAHOT): the translators' text — Leningrad with the Qere, restored text kept, words added from the
 *   LXX skipped (see isImported). Hebrew (MT) chapter/verse numbering; the English one is kept per word.
 *   Only root words are concordance rows; prefixes/suffixes are stored in the word's `segments`.
 */
import { createReadStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { bookByCode } from "../src/lib/books";
import { normalizeGreek, normalizeLatin, stripPunctuation } from "../src/lib/greek";
import { normalizeHebrew } from "../src/lib/hebrew";
import { hebrewDefinitionHtml, parseAugIndex, parseBdb, parseLexicalIndex, parseStrongsHebrew, type HebrewLexicon } from "./oshb";
import { TAHOT_FILES, isImported, parseTahotLine, parseTbeshLine, rootSegments, segmentsJson, type TahotSegment, type TahotToken, type TbeshEntry } from "./tahot";
import { isNA28, lemmaIdFor, parseTagntLine, parseTbesgLine, strongsBase, type TagntToken, type TbesgEntry } from "./tagnt";

const RAW = join(process.cwd(), "data", "raw");
const OUT = join(process.cwd(), "data", "sql");
const ROWS_PER_STATEMENT = 100;
const STATEMENTS_PER_FILE = 150;

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

interface OtOccRow {
  lemmaId: number;
  token: TahotToken;
  bookOrd: number;
  position: number;
  part: number;
  segment: TahotSegment;
}

async function main() {
  const version = JSON.parse(await readFile(join(RAW, "VERSION.json"), "utf8").catch(() => '{"sha":"unknown"}'));
  // Japanese glosses (scripts/translate-glosses.ts), committed to the repo; optional.
  const glossesJa: Record<string, string> = JSON.parse(
    await readFile(join(process.cwd(), "data", "glosses-ja.json"), "utf8").catch(() => "{}"),
  );

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

  // --- TBESH lexicon (Hebrew / Aramaic). Its Meaning column is not read (Abridged BDB © Online Bible).
  const tbesh = new Map<string, TbeshEntry>();
  const tbeshByBase = new Map<string, TbeshEntry>();
  await readLines(join(RAW, "TBESH.txt"), line => {
    const e = parseTbeshLine(line);
    if (!e) return;
    if (!tbesh.has(e.strongs)) tbesh.set(e.strongs, e);
    const base = strongsBase(e.strongs);
    if (!tbeshByBase.has(base)) tbeshByBase.set(base, e);
  });
  console.log(`TBESH entries: ${tbesh.size}`);

  // --- Open Scriptures Hebrew Lexicon (BDB outline + Strong's): the Hebrew definitions
  const hebLex: HebrewLexicon = {
    aug: parseAugIndex(await readFile(join(RAW, "AugIndex.xml"), "utf8")),
    index: parseLexicalIndex(await readFile(join(RAW, "LexicalIndex.xml"), "utf8")),
    bdb: parseBdb(await readFile(join(RAW, "BrownDriverBriggs.xml"), "utf8")),
    strongs: parseStrongsHebrew(await readFile(join(RAW, "HebrewStrong.xml"), "utf8")),
  };
  console.log(`HebrewLexicon: BDB entries ${hebLex.bdb.size}, Strong's entries ${hebLex.strongs.size}`);

  // --- TAHOT tokens, grouped by MT verse (words are renumbered 1…n within each verse)
  const otVerses = new Map<string, { bookOrd: number; tokens: TahotToken[] }>();
  let otRows = 0;
  let otSkipped = 0;
  for (const f of TAHOT_FILES) {
    await readLines(join(RAW, f), line => {
      const t = parseTahotLine(line);
      if (!t) return;
      otRows++;
      if (!isImported(t)) {
        otSkipped++;
        return;
      }
      const book = bookByCode(t.book);
      if (!book || book.testament !== "OT") throw new Error(`Unknown OT book ${t.book}`);
      const key = `${book.ord}.${t.chapter}.${t.verse}`;
      let v = otVerses.get(key);
      if (!v) otVerses.set(key, (v = { bookOrd: book.ord, tokens: [] }));
      v.tokens.push(t);
    });
  }
  const otOccurrences: OtOccRow[] = [];
  let otTokens = 0;
  for (const [key, v] of otVerses) {
    v.tokens.sort((a, b) => a.sortKey - b.sortKey);
    v.tokens.forEach((t, i) => {
      if (i > 0 && v.tokens[i - 1].sortKey === t.sortKey) throw new Error(`Duplicate token ${key}#${t.wordNo}`);
      const roots = rootSegments(t);
      if (roots.length === 0) throw new Error(`No root word for ${key}#${t.wordNo}`);
      otTokens++;
      roots.forEach((s, part) => otOccurrences.push({ lemmaId: lemmaIdFor(s.strongs!), token: t, bookOrd: v.bookOrd, position: i + 1, part, segment: s }));
    });
  }
  console.log(`TAHOT rows: ${otRows}, imported tokens: ${otTokens}, skipped (LXX additions, unread Ketiv): ${otSkipped}, occurrence rows: ${otOccurrences.length}`);

  // --- Lemmas
  const lemmaStats = new Map<number, { strongs: string; count: number; verses: Set<string>; aramaic: number }>();
  function addStat(id: number, strongs: string, verseKey: string, aramaic: boolean) {
    let s = lemmaStats.get(id);
    if (!s) lemmaStats.set(id, (s = { strongs, count: 0, verses: new Set(), aramaic: 0 }));
    s.count++;
    s.verses.add(verseKey);
    if (aramaic) s.aramaic++;
  }
  for (const o of occurrences) addStat(o.lemmaId, o.token.parts[o.part].strongs, `${o.token.bookOrd}.${o.token.chapter}.${o.token.verse}`, false);
  for (const o of otOccurrences) addStat(o.lemmaId, o.segment.strongs!, `${o.bookOrd}.${o.token.chapter}.${o.token.verse}`, o.token.language === "arc");

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
    "DELETE FROM data_versions WHERE source IN ('STEPBible-Data', 'HebrewLexicon');",
  ]);

  const missingLex: string[] = [];
  const missingHebLex: string[] = [];
  const noHebDef: string[] = [];
  const lemmaRows: (string | number | null)[][] = [];
  const defRows: (string | number | null)[][] = [];
  // Most frequent root form per Hebrew lemma, as a fallback headword when TBESH lacks the entry.
  const hebForms = new Map<string, Map<string, number>>();
  for (const o of otOccurrences) {
    const m = hebForms.get(o.segment.strongs!) ?? new Map<string, number>();
    m.set(o.segment.hebrew, (m.get(o.segment.hebrew) ?? 0) + 1);
    hebForms.set(o.segment.strongs!, m);
  }
  for (const [id, s] of [...lemmaStats].sort((a, b) => a[0] - b[0])) {
    if (s.strongs.startsWith("H")) {
      const lex = tbesh.get(s.strongs) ?? tbeshByBase.get(strongsBase(s.strongs));
      if (!tbesh.has(s.strongs)) missingHebLex.push(`${s.strongs}${lex ? `→${lex.strongs}` : "(none)"}`);
      const hebrew = lex?.hebrew || [...(hebForms.get(s.strongs) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0] || s.strongs;
      lemmaRows.push([
        id,
        s.strongs,
        strongsBase(s.strongs),
        s.aramaic * 2 > s.count ? "arc" : "hbo",
        hebrew,
        normalizeHebrew(hebrew),
        null,
        null,
        lex?.transliteration ?? null,
        lex?.transliteration ? normalizeLatin(lex.transliteration) : null,
        lex?.gloss ?? null,
        glossesJa[s.strongs] ?? null,
        lex?.pos ?? null,
        s.count,
        s.verses.size,
      ]);
      const def = hebrewDefinitionHtml(hebLex, lex?.eStrong ?? strongsBase(s.strongs), strongsBase(s.strongs));
      if (def) defRows.push([id, def]);
      else noHebDef.push(s.strongs);
      continue;
    }
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
      "grc",
      greek,
      normalizeGreek(greek),
      alt,
      alt ? normalizeGreek(alt) : null,
      lex?.transliteration ?? null,
      lex?.transliteration ? normalizeLatin(lex.transliteration) : null,
      lex?.gloss ?? null,
      glossesJa[s.strongs] ?? null,
      lex?.pos ?? null,
      s.count,
      s.verses.size,
    ]);
    if (lex?.definition) defRows.push([id, lex.definition]);
  }
  if (missingLex.length) console.warn(`Lemmas without exact TBESG entry (${missingLex.length}): ${missingLex.join(" ")}`);
  if (missingHebLex.length) console.warn(`Lemmas without exact TBESH entry (${missingHebLex.length}): ${missingHebLex.join(" ")}`);
  if (noHebDef.length) console.warn(`Hebrew lemmas without BDB or Strong's definition (${noHebDef.length}): ${noHebDef.join(" ")}`);
  console.log(`Lemmas: ${lemmaRows.length} (Hebrew/Aramaic: ${lemmaRows.filter(r => r[3] !== "grc").length}, Japanese gloss: ${lemmaRows.filter(r => r[11]).length})`);

  await emit(
    "lemmas",
    inserts(
      "lemmas",
      ["id", "strongs_id", "strongs_base", "language", "lemma", "lemma_plain", "alt_lemma", "alt_lemma_plain", "transliteration", "translit_plain", "gloss", "gloss_ja", "lex_pos", "occurrence_count", "verse_count"],
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
      null,
      null,
      null,
      null,
      null,
    ];
  });
  for (const o of otOccurrences) {
    const t = o.token;
    occRows.push([
      occId++,
      o.lemmaId,
      o.bookOrd,
      t.book,
      t.chapter,
      t.verse,
      o.position,
      o.part,
      t.surface,
      normalizeHebrew(t.surface),
      t.transliteration || null,
      t.transliteration ? normalizeLatin(t.transliteration) : null,
      t.english,
      o.segment.morph ?? "",
      t.wordType,
      "",
      t.instance,
      t.engChapter,
      t.engVerse,
      segmentsJson(t.segments),
      t.ketiv,
      t.ketivGloss,
    ]);
  }
  await emit(
    "occurrences",
    inserts(
      "occurrences",
      ["id", "lemma_id", "book_ord", "book", "chapter", "verse", "token_position", "part", "surface_form", "surface_plain", "transliteration", "translit_plain", "english_gloss", "morphology_code", "word_type", "edition_info", "instance", "eng_chapter", "eng_verse", "segments", "ketiv", "ketiv_gloss"],
      occRows,
    ),
  );

  const detail = JSON.stringify({
    commitDate: version.commitDate ?? null,
    filter: "edition contains NA28",
    tokens: seen.size,
    occurrenceRows: occurrences.length,
    otFilter: "TAHOT: Leningrad + Qere + restored text; LXX additions excluded",
    otTokens,
    otOccurrenceRows: otOccurrences.length,
    lemmas: lemmaRows.length,
  });
  await emit("version", [
    `INSERT INTO data_versions (source, version, detail, imported_at) VALUES (${q("STEPBible-Data")}, ${q(version.sha)}, ${q(detail)}, ${q(new Date().toISOString())});`,
    `INSERT INTO data_versions (source, version, detail, imported_at) VALUES (${q("HebrewLexicon")}, ${q(version.hebrewLexicon?.sha ?? "unknown")}, ${q(
      JSON.stringify({ repo: version.hebrewLexicon?.repo ?? null, commitDate: version.hebrewLexicon?.commitDate ?? null }),
    )}, ${q(new Date().toISOString())});`,
  ]);

  await writeFile(join(OUT, "manifest.json"), JSON.stringify({ version: version.sha, files }, null, 2) + "\n");
  console.log(`Wrote ${files.length} SQL files to data/sql/`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
