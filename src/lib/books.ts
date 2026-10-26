export interface Book {
  ord: number;
  /** Code used by TAGNT (and in our URLs / references). */
  code: string;
  /** Book ID used by bible.helloao.org (USFM style). */
  usfm: string;
  en: string;
  ja: string;
  /** BibleHub URL slug. */
  biblehub: string;
}

export const BOOKS: Book[] = [
  { ord: 1, code: "Mat", usfm: "MAT", en: "Matthew", ja: "マタイ", biblehub: "matthew" },
  { ord: 2, code: "Mrk", usfm: "MRK", en: "Mark", ja: "マルコ", biblehub: "mark" },
  { ord: 3, code: "Luk", usfm: "LUK", en: "Luke", ja: "ルカ", biblehub: "luke" },
  { ord: 4, code: "Jhn", usfm: "JHN", en: "John", ja: "ヨハネ", biblehub: "john" },
  { ord: 5, code: "Act", usfm: "ACT", en: "Acts", ja: "使徒", biblehub: "acts" },
  { ord: 6, code: "Rom", usfm: "ROM", en: "Romans", ja: "ローマ", biblehub: "romans" },
  { ord: 7, code: "1Co", usfm: "1CO", en: "1 Corinthians", ja: "Ⅰコリント", biblehub: "1_corinthians" },
  { ord: 8, code: "2Co", usfm: "2CO", en: "2 Corinthians", ja: "Ⅱコリント", biblehub: "2_corinthians" },
  { ord: 9, code: "Gal", usfm: "GAL", en: "Galatians", ja: "ガラテヤ", biblehub: "galatians" },
  { ord: 10, code: "Eph", usfm: "EPH", en: "Ephesians", ja: "エペソ", biblehub: "ephesians" },
  { ord: 11, code: "Php", usfm: "PHP", en: "Philippians", ja: "ピリピ", biblehub: "philippians" },
  { ord: 12, code: "Col", usfm: "COL", en: "Colossians", ja: "コロサイ", biblehub: "colossians" },
  { ord: 13, code: "1Th", usfm: "1TH", en: "1 Thessalonians", ja: "Ⅰテサロニケ", biblehub: "1_thessalonians" },
  { ord: 14, code: "2Th", usfm: "2TH", en: "2 Thessalonians", ja: "Ⅱテサロニケ", biblehub: "2_thessalonians" },
  { ord: 15, code: "1Ti", usfm: "1TI", en: "1 Timothy", ja: "Ⅰテモテ", biblehub: "1_timothy" },
  { ord: 16, code: "2Ti", usfm: "2TI", en: "2 Timothy", ja: "Ⅱテモテ", biblehub: "2_timothy" },
  { ord: 17, code: "Tit", usfm: "TIT", en: "Titus", ja: "テトス", biblehub: "titus" },
  { ord: 18, code: "Phm", usfm: "PHM", en: "Philemon", ja: "ピレモン", biblehub: "philemon" },
  { ord: 19, code: "Heb", usfm: "HEB", en: "Hebrews", ja: "ヘブル", biblehub: "hebrews" },
  { ord: 20, code: "Jas", usfm: "JAS", en: "James", ja: "ヤコブ", biblehub: "james" },
  { ord: 21, code: "1Pe", usfm: "1PE", en: "1 Peter", ja: "Ⅰペテロ", biblehub: "1_peter" },
  { ord: 22, code: "2Pe", usfm: "2PE", en: "2 Peter", ja: "Ⅱペテロ", biblehub: "2_peter" },
  { ord: 23, code: "1Jn", usfm: "1JN", en: "1 John", ja: "Ⅰヨハネ", biblehub: "1_john" },
  { ord: 24, code: "2Jn", usfm: "2JN", en: "2 John", ja: "Ⅱヨハネ", biblehub: "2_john" },
  { ord: 25, code: "3Jn", usfm: "3JN", en: "3 John", ja: "Ⅲヨハネ", biblehub: "3_john" },
  { ord: 26, code: "Jud", usfm: "JUD", en: "Jude", ja: "ユダ", biblehub: "jude" },
  { ord: 27, code: "Rev", usfm: "REV", en: "Revelation", ja: "黙示録", biblehub: "revelation" },
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
