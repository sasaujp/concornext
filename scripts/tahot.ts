/**
 * Parsers for STEPBible TAHOT (Translators Amalgamated Hebrew OT) and TBESH (Hebrew brief lexicon).
 * Kept free of I/O so they can be unit-tested.
 *
 * A TAHOT word row looks like (tab-separated):
 *
 *   Gen.1.1#07=L  הָ/אָֽרֶץ\׃  ha./'A.retz  the/ earth  H9009/{H0776G}\H9016  HTd/Ncfsa  …
 *
 * - The reference is the English verse, followed by the Hebrew (MT) verse in parentheses when they differ:
 *   `Psa.51.0(51.1)#01=L` (Psalm titles are verse 0 in English numbering).
 * - Hebrew, transliteration, dStrongs and grammar are split into the same number of segments by "/":
 *   prefixes and suffixes (H9001–H9049, unbraced) and the root word(s) in {braces}. A segment can end in
 *   punctuation introduced by "\" (maqqef ־ H9014, sof pasuq ׃ H9016, paseq ׀ H9015, ס/פ section marks …).
 *   Several Hebrew words in one row are separated by an empty segment ("//") or a space segment ("/ /").
 * - The grammar's first letter is the language (H = Hebrew, A = Aramaic) and applies to every segment;
 *   `language + segment` is a TEHMC code (HR, HNcfsa, HSp3ms).
 * - A "+" after a braced tag means the same tag also covers the next Hebrew word (multi-word names
 *   such as Tubal-cain, Beth-el); the next word repeats the tag.
 */

/** The TAHOT files as downloaded by scripts/download-data.ts. */
export const TAHOT_FILES = ["TAHOT_Gen-Deu.txt", "TAHOT_Jos-Est.txt", "TAHOT_Job-Sng.txt", "TAHOT_Isa-Mal.txt"];

/**
 * Source of the word (first letter of the TAHOT type):
 * L = Leningrad codex, Q = Qere (scribal reading; the Ketiv is a variant), R = restored from a parallel
 * passage (Jos.21.36-37, Neh.7.67b), X = added from the LXX (not in the Hebrew manuscripts),
 * V = a variant in some manuscripts.
 */
export type TahotSource = "L" | "Q" | "R" | "X" | "V";

export type SegmentKind = "root" | "affix" | "punctuation" | "separator";

export interface TahotSegment {
  kind: SegmentKind;
  /** Hebrew text of the segment, without trailing punctuation. */
  hebrew: string;
  transliteration: string;
  /** dStrong, e.g. H7225G, H9003; null for separators. */
  strongs: string | null;
  /** TEHMC morphology code (HNcfsa, ATr); null for punctuation and separators. */
  morph: string | null;
  /** The tag also covers the next Hebrew word ("+"). */
  continuesNext: boolean;
  /** Punctuation that follows the segment (׃, ־, ׀, " פ" …), as printed. */
  trailing: string;
}

export interface TahotToken {
  book: string;
  /** Hebrew (MT) chapter and verse — the numbering ConcorNext uses. */
  chapter: number;
  verse: number;
  /** English chapter and verse (BSB numbering); differs from MT in ~1,800 verses. */
  engChapter: number;
  engVerse: number;
  /** Word number as written ("07", or "0501" for a word inserted after word 05). */
  wordNo: string;
  /** Orders words within a verse: "05" → 500, "0501" → 501, "06" → 600. */
  sortKey: number;
  source: TahotSource;
  /** Full TAHOT type, e.g. L, Q(K), L(abh). */
  wordType: string;
  language: "hbo" | "arc" | null;
  /** Hebrew as printed (segment markers removed, punctuation kept). Empty for a Ketiv that is not read. */
  surface: string;
  transliteration: string;
  english: string;
  segments: TahotSegment[];
  /** For Qere words: the Ketiv (written) form. */
  ketiv: string | null;
  /** For Qere words whose Ketiv differs in meaning (type Q(K)): the Ketiv's English gloss. */
  ketivGloss: string | null;
  /** TAHOT "Root dStrong+Instance", e.g. "H0853_A". */
  instance: string | null;
}

// Gen.1.1#01=L   |   Psa.51.0(51.1)#01=L   |   Gen.4.8#0501=X   |   Neh.2.13#17=Q(K+B)
const ROW_RE = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#(\d+)=(\S+)$/;
const TAG_RE = /^(\{)?(H\d{4}[A-Za-z]?)(\})?(\+)?$/;
const PUNCTUATION_TAG = /^H901[4-9]$/;

/** Removes TAHOT's segment markers ("/" between segments, "\" before punctuation); "//" separates words. */
export function joinSegments(s: string): string {
  return s.replace(/\/\//g, " ").replace(/[/\\]/g, "");
}

function splitTrailing(s: string): [string, string] {
  const i = s.indexOf("\\");
  return i < 0 ? [s, ""] : [s.slice(0, i), s.slice(i + 1)];
}

function parseSegments(hebrew: string, translit: string, strongs: string, grammar: string): TahotSegment[] {
  const lang = grammar.slice(0, 1);
  const hs = hebrew.split("/");
  const ts = translit.split("/");
  const ss = strongs.split("/");
  const gs = grammar.slice(1).split("/");
  if (hs.length !== ss.length || gs.length !== ss.length) {
    throw new Error(`Segment count mismatch: ${hebrew} | ${strongs} | ${grammar}`);
  }
  return ss.map((raw, i) => {
    const [tagPart] = splitTrailing(raw);
    const [heb, trailing] = splitTrailing(hs[i]);
    const tag = tagPart.trim();
    const tr = (ts[i] ?? "").trim();
    if (tag === "") {
      return { kind: "separator", hebrew: heb, transliteration: tr, strongs: null, morph: null, continuesNext: false, trailing: trailing.replace(/\\/g, "") };
    }
    const m = tag.match(TAG_RE);
    if (!m) throw new Error(`Bad dStrong segment "${raw}" in ${strongs}`);
    const code = m[2];
    const kind: SegmentKind = m[1] ? "root" : PUNCTUATION_TAG.test(code) ? "punctuation" : "affix";
    return {
      kind,
      hebrew: heb,
      transliteration: tr,
      strongs: code,
      morph: kind === "punctuation" || !gs[i] ? null : lang + gs[i],
      continuesNext: Boolean(m[4]),
      trailing: trailing.replace(/\\/g, ""),
    };
  });
}

/** Ketiv form from the variant columns: `K= translit (HEBREW) "gloss" (…)` or `…;K= HEBREW`. */
export function parseKetiv(meaningVariants: string, spellingVariants: string): { ketiv: string; gloss: string | null } | null {
  const m = meaningVariants.match(/K=\s*\S*\s*\(([^)]*)\)\s*"([^"]*)"/);
  if (m) return { ketiv: joinSegments(m[1].trim()), gloss: m[2].trim() || null };
  const s = spellingVariants.match(/K=\s*([^¦;]+)/);
  if (s) return { ketiv: joinSegments(s[1].trim()), gloss: null };
  return null;
}

export function parseTahotLine(line: string): TahotToken | null {
  if (!/^[1-3]?[A-Za-z]{2,3}\.\d/.test(line)) return null;
  const cols = line.split("\t");
  const m = cols[0].trim().match(ROW_RE);
  if (!m) return null;
  const [, book, engC, engV, hebC, hebV, wordNo, wordType] = m;
  const hebrew = (cols[1] ?? "").trim();
  const translit = (cols[2] ?? "").trim();
  const strongs = (cols[4] ?? "").trim();
  const grammar = (cols[5] ?? "").trim();
  const isQere = wordType.startsWith("Q");
  const ketiv = isQere ? parseKetiv(cols[6] ?? "", cols[7] ?? "") : null;
  const lang = grammar.slice(0, 1);
  return {
    book,
    chapter: Number(hebC ?? engC),
    verse: Number(hebV ?? engV),
    engChapter: Number(engC),
    engVerse: Number(engV),
    wordNo,
    sortKey: wordNo.length > 2 ? Number(wordNo) : Number(wordNo) * 100,
    source: wordType[0] as TahotSource,
    wordType,
    language: lang === "H" ? "hbo" : lang === "A" ? "arc" : null,
    surface: joinSegments(hebrew),
    transliteration: joinSegments(translit),
    english: (cols[3] ?? "").trim(),
    segments: hebrew ? parseSegments(hebrew, translit, strongs, grammar) : [],
    ketiv: ketiv?.ketiv ?? null,
    ketivGloss: ketiv?.gloss ?? null,
    instance: (cols[8] ?? "").trim() || null,
  };
}

/**
 * Words ConcorNext imports: the translators' text (Leningrad with the Qere, plus restored text), without
 * words added from the LXX (X) and without Ketiv words that are not read (empty Qere rows).
 */
export function isImported(t: Pick<TahotToken, "source" | "surface">): boolean {
  return t.source !== "X" && t.surface !== "";
}

/** The root (lexical) segments of a word — the lemmas it appears under in the concordance. */
export function rootSegments(t: Pick<TahotToken, "segments">): TahotSegment[] {
  return t.segments.filter(s => s.kind === "root");
}

export interface TbeshEntry {
  /** Extended Strong's (OpenScriptures-compatible), e.g. H1254a. */
  eStrong: string;
  /** Disambiguated Strong's as used in TAHOT, e.g. H1254A, H0430G. */
  strongs: string;
  /** Unified Strong's linking variant spellings / names of the same thing. */
  uStrong: string;
  hebrew: string;
  transliteration: string;
  /** e.g. H:V, A:N-M, N:N-M-P (H = Hebrew, A = Aramaic, N = name). */
  pos: string;
  gloss: string;
}

/**
 * Reads a TBESH row. The Meaning column (column 8) is deliberately not read: it is the Abridged BDB
 * © Online Bible, which needs separate permission. Hebrew definitions come from openscriptures/HebrewLexicon.
 */
export function parseTbeshLine(line: string): TbeshEntry | null {
  if (!/^H\d{4}[a-z]?\t/.test(line)) return null;
  const cols = line.split("\t");
  if (cols.length < 7) return null;
  const strongs = (cols[1] ?? "").trim().split(/\s+/)[0];
  if (!/^H\d{4}[A-Za-z]?$/.test(strongs)) return null;
  return {
    eStrong: cols[0].trim(),
    strongs,
    uStrong: (cols[2] ?? "").trim(),
    hebrew: (cols[3] ?? "").trim(),
    transliteration: (cols[4] ?? "").trim(),
    pos: (cols[5] ?? "").trim(),
    gloss: (cols[6] ?? "").trim(),
  };
}
