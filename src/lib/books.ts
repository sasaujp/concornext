export type Testament = "OT" | "NT";

export interface Book {
  /** Canonical order: 1 = Genesis … 39 = Malachi, 40 = Matthew … 66 = Revelation. */
  ord: number;
  testament: Testament;
  /** Code used by TAGNT / TAHOT (and in our URLs / references). */
  code: string;
  /** Book ID used by bible.helloao.org (USFM style). */
  usfm: string;
  en: string;
  ja: string;
  /** BibleHub URL slug. */
  biblehub: string;
}

export const BOOKS: Book[] = [
  { ord: 1, testament: "OT", code: "Gen", usfm: "GEN", en: "Genesis", ja: "創世記", biblehub: "genesis" },
  { ord: 2, testament: "OT", code: "Exo", usfm: "EXO", en: "Exodus", ja: "出エジプト記", biblehub: "exodus" },
  { ord: 3, testament: "OT", code: "Lev", usfm: "LEV", en: "Leviticus", ja: "レビ記", biblehub: "leviticus" },
  { ord: 4, testament: "OT", code: "Num", usfm: "NUM", en: "Numbers", ja: "民数記", biblehub: "numbers" },
  { ord: 5, testament: "OT", code: "Deu", usfm: "DEU", en: "Deuteronomy", ja: "申命記", biblehub: "deuteronomy" },
  { ord: 6, testament: "OT", code: "Jos", usfm: "JOS", en: "Joshua", ja: "ヨシュア記", biblehub: "joshua" },
  { ord: 7, testament: "OT", code: "Jdg", usfm: "JDG", en: "Judges", ja: "士師記", biblehub: "judges" },
  { ord: 8, testament: "OT", code: "Rut", usfm: "RUT", en: "Ruth", ja: "ルツ記", biblehub: "ruth" },
  { ord: 9, testament: "OT", code: "1Sa", usfm: "1SA", en: "1 Samuel", ja: "Ⅰサムエル", biblehub: "1_samuel" },
  { ord: 10, testament: "OT", code: "2Sa", usfm: "2SA", en: "2 Samuel", ja: "Ⅱサムエル", biblehub: "2_samuel" },
  { ord: 11, testament: "OT", code: "1Ki", usfm: "1KI", en: "1 Kings", ja: "Ⅰ列王", biblehub: "1_kings" },
  { ord: 12, testament: "OT", code: "2Ki", usfm: "2KI", en: "2 Kings", ja: "Ⅱ列王", biblehub: "2_kings" },
  { ord: 13, testament: "OT", code: "1Ch", usfm: "1CH", en: "1 Chronicles", ja: "Ⅰ歴代", biblehub: "1_chronicles" },
  { ord: 14, testament: "OT", code: "2Ch", usfm: "2CH", en: "2 Chronicles", ja: "Ⅱ歴代", biblehub: "2_chronicles" },
  { ord: 15, testament: "OT", code: "Ezr", usfm: "EZR", en: "Ezra", ja: "エズラ", biblehub: "ezra" },
  { ord: 16, testament: "OT", code: "Neh", usfm: "NEH", en: "Nehemiah", ja: "ネヘミヤ", biblehub: "nehemiah" },
  { ord: 17, testament: "OT", code: "Est", usfm: "EST", en: "Esther", ja: "エステル", biblehub: "esther" },
  { ord: 18, testament: "OT", code: "Job", usfm: "JOB", en: "Job", ja: "ヨブ", biblehub: "job" },
  { ord: 19, testament: "OT", code: "Psa", usfm: "PSA", en: "Psalms", ja: "詩篇", biblehub: "psalms" },
  { ord: 20, testament: "OT", code: "Pro", usfm: "PRO", en: "Proverbs", ja: "箴言", biblehub: "proverbs" },
  { ord: 21, testament: "OT", code: "Ecc", usfm: "ECC", en: "Ecclesiastes", ja: "伝道者", biblehub: "ecclesiastes" },
  { ord: 22, testament: "OT", code: "Sng", usfm: "SNG", en: "Song of Songs", ja: "雅歌", biblehub: "songs" },
  { ord: 23, testament: "OT", code: "Isa", usfm: "ISA", en: "Isaiah", ja: "イザヤ", biblehub: "isaiah" },
  { ord: 24, testament: "OT", code: "Jer", usfm: "JER", en: "Jeremiah", ja: "エレミヤ", biblehub: "jeremiah" },
  { ord: 25, testament: "OT", code: "Lam", usfm: "LAM", en: "Lamentations", ja: "哀歌", biblehub: "lamentations" },
  { ord: 26, testament: "OT", code: "Ezk", usfm: "EZK", en: "Ezekiel", ja: "エゼキエル", biblehub: "ezekiel" },
  { ord: 27, testament: "OT", code: "Dan", usfm: "DAN", en: "Daniel", ja: "ダニエル", biblehub: "daniel" },
  { ord: 28, testament: "OT", code: "Hos", usfm: "HOS", en: "Hosea", ja: "ホセア", biblehub: "hosea" },
  { ord: 29, testament: "OT", code: "Jol", usfm: "JOL", en: "Joel", ja: "ヨエル", biblehub: "joel" },
  { ord: 30, testament: "OT", code: "Amo", usfm: "AMO", en: "Amos", ja: "アモス", biblehub: "amos" },
  { ord: 31, testament: "OT", code: "Oba", usfm: "OBA", en: "Obadiah", ja: "オバデヤ", biblehub: "obadiah" },
  { ord: 32, testament: "OT", code: "Jon", usfm: "JON", en: "Jonah", ja: "ヨナ", biblehub: "jonah" },
  { ord: 33, testament: "OT", code: "Mic", usfm: "MIC", en: "Micah", ja: "ミカ", biblehub: "micah" },
  { ord: 34, testament: "OT", code: "Nam", usfm: "NAM", en: "Nahum", ja: "ナホム", biblehub: "nahum" },
  { ord: 35, testament: "OT", code: "Hab", usfm: "HAB", en: "Habakkuk", ja: "ハバクク", biblehub: "habakkuk" },
  { ord: 36, testament: "OT", code: "Zep", usfm: "ZEP", en: "Zephaniah", ja: "ゼパニヤ", biblehub: "zephaniah" },
  { ord: 37, testament: "OT", code: "Hag", usfm: "HAG", en: "Haggai", ja: "ハガイ", biblehub: "haggai" },
  { ord: 38, testament: "OT", code: "Zec", usfm: "ZEC", en: "Zechariah", ja: "ゼカリヤ", biblehub: "zechariah" },
  { ord: 39, testament: "OT", code: "Mal", usfm: "MAL", en: "Malachi", ja: "マラキ", biblehub: "malachi" },
  { ord: 40, testament: "NT", code: "Mat", usfm: "MAT", en: "Matthew", ja: "マタイ", biblehub: "matthew" },
  { ord: 41, testament: "NT", code: "Mrk", usfm: "MRK", en: "Mark", ja: "マルコ", biblehub: "mark" },
  { ord: 42, testament: "NT", code: "Luk", usfm: "LUK", en: "Luke", ja: "ルカ", biblehub: "luke" },
  { ord: 43, testament: "NT", code: "Jhn", usfm: "JHN", en: "John", ja: "ヨハネ", biblehub: "john" },
  { ord: 44, testament: "NT", code: "Act", usfm: "ACT", en: "Acts", ja: "使徒", biblehub: "acts" },
  { ord: 45, testament: "NT", code: "Rom", usfm: "ROM", en: "Romans", ja: "ローマ", biblehub: "romans" },
  { ord: 46, testament: "NT", code: "1Co", usfm: "1CO", en: "1 Corinthians", ja: "Ⅰコリント", biblehub: "1_corinthians" },
  { ord: 47, testament: "NT", code: "2Co", usfm: "2CO", en: "2 Corinthians", ja: "Ⅱコリント", biblehub: "2_corinthians" },
  { ord: 48, testament: "NT", code: "Gal", usfm: "GAL", en: "Galatians", ja: "ガラテヤ", biblehub: "galatians" },
  { ord: 49, testament: "NT", code: "Eph", usfm: "EPH", en: "Ephesians", ja: "エペソ", biblehub: "ephesians" },
  { ord: 50, testament: "NT", code: "Php", usfm: "PHP", en: "Philippians", ja: "ピリピ", biblehub: "philippians" },
  { ord: 51, testament: "NT", code: "Col", usfm: "COL", en: "Colossians", ja: "コロサイ", biblehub: "colossians" },
  { ord: 52, testament: "NT", code: "1Th", usfm: "1TH", en: "1 Thessalonians", ja: "Ⅰテサロニケ", biblehub: "1_thessalonians" },
  { ord: 53, testament: "NT", code: "2Th", usfm: "2TH", en: "2 Thessalonians", ja: "Ⅱテサロニケ", biblehub: "2_thessalonians" },
  { ord: 54, testament: "NT", code: "1Ti", usfm: "1TI", en: "1 Timothy", ja: "Ⅰテモテ", biblehub: "1_timothy" },
  { ord: 55, testament: "NT", code: "2Ti", usfm: "2TI", en: "2 Timothy", ja: "Ⅱテモテ", biblehub: "2_timothy" },
  { ord: 56, testament: "NT", code: "Tit", usfm: "TIT", en: "Titus", ja: "テトス", biblehub: "titus" },
  { ord: 57, testament: "NT", code: "Phm", usfm: "PHM", en: "Philemon", ja: "ピレモン", biblehub: "philemon" },
  { ord: 58, testament: "NT", code: "Heb", usfm: "HEB", en: "Hebrews", ja: "ヘブル", biblehub: "hebrews" },
  { ord: 59, testament: "NT", code: "Jas", usfm: "JAS", en: "James", ja: "ヤコブ", biblehub: "james" },
  { ord: 60, testament: "NT", code: "1Pe", usfm: "1PE", en: "1 Peter", ja: "Ⅰペテロ", biblehub: "1_peter" },
  { ord: 61, testament: "NT", code: "2Pe", usfm: "2PE", en: "2 Peter", ja: "Ⅱペテロ", biblehub: "2_peter" },
  { ord: 62, testament: "NT", code: "1Jn", usfm: "1JN", en: "1 John", ja: "Ⅰヨハネ", biblehub: "1_john" },
  { ord: 63, testament: "NT", code: "2Jn", usfm: "2JN", en: "2 John", ja: "Ⅱヨハネ", biblehub: "2_john" },
  { ord: 64, testament: "NT", code: "3Jn", usfm: "3JN", en: "3 John", ja: "Ⅲヨハネ", biblehub: "3_john" },
  { ord: 65, testament: "NT", code: "Jud", usfm: "JUD", en: "Jude", ja: "ユダ", biblehub: "jude" },
  { ord: 66, testament: "NT", code: "Rev", usfm: "REV", en: "Revelation", ja: "黙示録", biblehub: "revelation" },
];

const byCode = new Map(BOOKS.map(b => [b.code, b]));
const byOrd = new Map(BOOKS.map(b => [b.ord, b]));

export function bookByCode(code: string): Book | undefined {
  return byCode.get(code);
}

export function bookByOrd(ord: number): Book | undefined {
  return byOrd.get(ord);
}

export interface VerseRef {
  book: Book;
  chapter: number;
  verse: number;
}

/** Parses "Jhn.1.6" (our canonical reference form). */
export function parseRef(ref: string): VerseRef | null {
  const m = ref.match(/^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const book = bookByCode(m[1]);
  if (!book) return null;
  return { book, chapter: Number(m[2]), verse: Number(m[3]) };
}

export function formatRef(code: string, chapter: number, verse: number): string {
  return `${code}.${chapter}.${verse}`;
}

export function displayRef(code: string, chapter: number, verse: number): string {
  const b = bookByCode(code);
  return `${b?.ja ?? code} ${chapter}:${verse}`;
}

/** Verse number meaning "to the end of the chapter". */
export const CHAPTER_END = 999;

/** A contiguous range of verses within one book (may span chapters). */
export interface Passage {
  book: Book;
  from: { chapter: number; verse: number };
  /** `verse` is CHAPTER_END when the range runs to the end of `chapter`. */
  to: { chapter: number; verse: number };
}

/**
 * Lookup key for book names: NFKC, lowercase, no spaces/dots. A leading Roman numeral (Ⅰ → "i") becomes a digit
 * only when a space, dot or non-Latin letter follows ("I Sam", "Ⅰコリント"), so "Isa" stays Isaiah.
 */
function bookKey(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^(i{1,3})(?=[\s.]|[^\x00-\x7f])/, m => String(m.length))
    .replace(/[\s.]/g, "");
}

const byName = new Map<string, Book>();
for (const b of BOOKS) for (const name of [b.code, b.usfm, b.en, b.ja]) byName.set(bookKey(name), b);

/** Book by code, USFM id, English or Japanese name, or an unambiguous prefix of the English name ("Matt", "1Cor"). */
export function findBook(name: string): Book | undefined {
  const key = bookKey(name);
  if (!key) return undefined;
  const exact = byName.get(key);
  if (exact) return exact;
  const prefixed = BOOKS.filter(b => bookKey(b.en).startsWith(key) || bookKey(b.ja).startsWith(key));
  return prefixed.length === 1 ? prefixed[0] : undefined;
}

/**
 * Parses a passage such as "Jhn.1.1-18", "ヨハネ 1:1-18", "John 1:1–2:11", "1コリント 13" (whole chapter)
 * or "Mat 5-7" (chapters 5 to 7).
 */
export function parsePassage(input: string): Passage | null {
  const s = input.normalize("NFKC").trim();
  const m = s.match(/^(.+?)\s*(\d+)(?:[:.](\d+))?(?:\s*[-–—~〜]\s*(\d+)(?:[:.](\d+))?)?$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const [c1, v1, a, b] = [m[2], m[3], m[4], m[5]].map(x => (x === undefined ? undefined : Number(x)));
  let from: Passage["from"];
  let to: Passage["to"];
  if (v1 === undefined) {
    // "5", "5-7", "5-7:12"
    from = { chapter: c1!, verse: 1 };
    to = a === undefined ? { chapter: c1!, verse: CHAPTER_END } : { chapter: a, verse: b ?? CHAPTER_END };
  } else {
    // "1:1", "1:1-18", "1:1-2:11"
    from = { chapter: c1!, verse: v1 };
    to = a === undefined ? { ...from } : b === undefined ? { chapter: c1!, verse: a } : { chapter: a, verse: b };
  }
  if (from.chapter < 1 || from.verse < 1 || to.chapter < 1 || to.verse < 1) return null;
  if (to.chapter < from.chapter || (to.chapter === from.chapter && to.verse < from.verse)) return null;
  return { book, from, to };
}

/** Canonical URL form: "Jhn.1.1-18", "Jhn.1.1-2.11", "Jhn.1", "Mat.5-7". */
export function formatPassage(p: Passage): string {
  const { from, to } = p;
  const wholeChapters = from.verse === 1 && to.verse === CHAPTER_END;
  if (wholeChapters) return `${p.book.code}.${from.chapter}${to.chapter === from.chapter ? "" : `-${to.chapter}`}`;
  const start = `${p.book.code}.${from.chapter}.${from.verse}`;
  const end = to.chapter === from.chapter ? `${to.verse}` : `${to.chapter}.${to.verse}`;
  return to.chapter === from.chapter && to.verse === from.verse ? start : `${start}-${end}`;
}

/** Display form: "ヨハネ 1:1–18", "ヨハネ 1章", "マタイ 5–7章". CHAPTER_END is shown as the chapter only. */
export function displayPassage(p: Passage): string {
  const { from, to } = p;
  const ja = p.book.ja;
  if (from.verse === 1 && to.verse === CHAPTER_END) return `${ja} ${from.chapter}${to.chapter === from.chapter ? "" : `–${to.chapter}`}章`;
  const end = to.verse === CHAPTER_END ? `${to.chapter}章末` : to.chapter === from.chapter ? `${to.verse}` : `${to.chapter}:${to.verse}`;
  return to.chapter === from.chapter && to.verse === from.verse ? `${ja} ${from.chapter}:${from.verse}` : `${ja} ${from.chapter}:${from.verse}–${end}`;
}
