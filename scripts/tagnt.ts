/**
 * Parsers for STEPBible TAGNT and TBESG text files.
 * Kept free of I/O so they can be unit-tested.
 */
import { bookByCode } from "../src/lib/books";

export interface TagntPart {
  strongs: string; // dStrong, e.g. G3056, G2491G
  morph: string; // e.g. N-NSM
}

export interface TagntToken {
  book: string;
  bookOrd: number;
  chapter: number;
  verse: number;
  position: number;
  wordType: string;
  surface: string;
  transliteration: string | null;
  english: string;
  parts: TagntPart[];
  dictionaryForm: string;
  editions: string;
  instance: string | null;
}

// Mat.1.1#01=NKO   |   Act.2.11[2.10]#03=NKO   |   Mrk.12.15(12.14)#01=NKO
const ROW_RE = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:[[({][^\]})]*[\]})])?#(\d+)=(\S+)$/;

export function parseTagntLine(line: string): TagntToken | null {
  if (!/^[1-3]?[A-Za-z]{2,3}\.\d/.test(line)) return null;
  const cols = line.split("\t");
  const m = cols[0].trim().match(ROW_RE);
  if (!m) return null;
  const book = bookByCode(m[1]);
  if (!book) return null;

  const greekCol = (cols[1] ?? "").trim();
  const gm = greekCol.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const surface = (gm ? gm[1] : greekCol).trim();
  const transliteration = gm ? gm[2].trim() : null;

  // "G3056=N-NSM"  or crasis "G2532=CONJ + G1565=D-NSM"
  const parts: TagntPart[] = (cols[3] ?? "")
    .split(/\s*\+\s*/)
    .map(p => {
      const [strongs, morph] = p.trim().split("=");
      return { strongs: (strongs ?? "").trim(), morph: (morph ?? "").trim() };
    })
    .filter(p => /^G\d+[A-Z]?$/.test(p.strongs));

  const dict = (cols[4] ?? "").split("=")[0].trim();
  const instance = (cols[11] ?? "").trim() || null;

  return {
    book: book.code,
    bookOrd: book.ord,
    chapter: Number(m[2]),
    verse: Number(m[3]),
    position: Number(m[4]),
    wordType: m[5],
    surface,
    transliteration,
    english: (cols[2] ?? "").trim(),
    parts,
    dictionaryForm: dict,
    editions: (cols[5] ?? "").trim(),
    instance,
  };
}

/** True when the word belongs to the NA28 text (the edition list includes NA28, possibly with a word-order shift). */
export function isNA28(token: Pick<TagntToken, "editions">): boolean {
  return token.editions.split("+").some(e => /^NA28(?:[«»]\d+)?$/.test(e.trim()));
}

/** Word-order displacement of the NA28 reading relative to TAGNT's base order (e.g. "»2"), or null. */
export function na28Displacement(token: Pick<TagntToken, "editions">): string | null {
  for (const e of token.editions.split("+")) {
    const m = e.trim().match(/^NA28([«»]\d+)$/);
    if (m) return m[1];
  }
  return null;
}

export interface TbesgEntry {
  base: string; // first column: eStrong without disambiguation, e.g. G2491
  strongs: string; // extended Strong's, e.g. G2491G
  greek: string;
  transliteration: string;
  pos: string;
  gloss: string;
  definition: string;
}

export function parseTbesgLine(line: string): TbesgEntry | null {
  if (!/^G\d/.test(line)) return null;
  const cols = line.split("\t");
  if (cols.length < 8) return null;
  const strongs = (cols[1] ?? "").trim().split(/\s+/)[0];
  if (!/^G\d+[A-Z]?$/.test(strongs)) return null;
  return {
    base: (cols[0] ?? "").trim(),
    strongs,
    greek: (cols[3] ?? "").trim(),
    transliteration: (cols[4] ?? "").trim(),
    pos: (cols[5] ?? "").trim(),
    gloss: (cols[6] ?? "").trim(),
    definition: (cols[7] ?? "").trim(),
  };
}

/** Plain Strong's number without the disambiguation letter: G2491G → G2491. */
export function strongsBase(strongs: string): string {
  return strongs.replace(/[A-Z]$/, "");
}

/** Deterministic ordering key so lemma IDs stay stable across imports. */
export function strongsSortKey(strongs: string): [number, string] {
  const m = strongs.match(/^G(\d+)([A-Z]?)$/);
  return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, strongs];
}
