/**
 * Deterministic lexicon / concordance queries against D1.
 * Everything shown as "data" in the UI comes from here, never from the LLM.
 */
import { and, asc, desc, eq, inArray, isNotNull, like, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteSelect } from "drizzle-orm/sqlite-core";
import { lemmaDefinitions, lemmaNotes, lemmas, occurrences, userSettings } from "~/db/schema";
import { BOOKS, bookByCode, bookByOrd } from "~/lib/books";
import { containsGreek, normalizeGreek, normalizeLatin, parseStrongs } from "~/lib/greek";
import type { Db } from "./db";

export type LemmaSort = "freq" | "alpha";

export interface LemmaListItem {
  id: number;
  strongsId: string;
  greekLemma: string;
  altLemma: string | null;
  transliteration: string | null;
  gloss: string | null;
  /** Japanese gloss (translated from `gloss`), when available. */
  glossJa: string | null;
  occurrenceCount: number;
  verseCount: number;
  note: string | null;
}

export interface LemmaSearchResult {
  items: LemmaListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** How the query was interpreted (shown to the user). */
  mode: "all" | "strongs" | "greek" | "latin";
  /** Book scope applied (counts are within this book), or null. */
  book: string | null;
}

const listColumns = {
  id: lemmas.id,
  strongsId: lemmas.strongsId,
  greekLemma: lemmas.greekLemma,
  altLemma: lemmas.altLemma,
  transliteration: lemmas.transliteration,
  gloss: lemmas.gloss,
  glossJa: lemmas.glossJa,
  occurrenceCount: lemmas.occurrenceCount,
  verseCount: lemmas.verseCount,
  note: lemmaNotes.note,
};

export async function searchLemmas(
  db: Db,
  opts: {
    /** Whose memos to show / filter on. */
    userId: string;
    q?: string;
    sort?: LemmaSort;
    letter?: string | null;
    withNote?: boolean;
    book?: string | null;
    page?: number;
    pageSize?: number;
  },
): Promise<LemmaSearchResult> {
  const q = (opts.q ?? "").trim();
  const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  let where: SQL | undefined;
  let mode: LemmaSearchResult["mode"] = "all";

  const strongs = q ? parseStrongs(q) : null;
  if (strongs) {
    mode = "strongs";
    where = strongs.extended ? eq(lemmas.strongsId, strongs.extended) : eq(lemmas.strongsBase, strongs.base);
  } else if (q && containsGreek(q)) {
    mode = "greek";
    const norm = normalizeGreek(q);
    // Dictionary form prefix match, or any lemma attested with exactly this (accent-insensitive) surface form.
    where = or(
      like(lemmas.lemmaPlain, `${norm}%`),
      like(lemmas.altLemmaPlain, `${norm}%`),
      inArray(
        lemmas.id,
        db.selectDistinct({ id: occurrences.lemmaId }).from(occurrences).where(eq(occurrences.surfacePlain, norm)),
      ),
    );
  } else if (q) {
    mode = "latin";
    const norm = normalizeLatin(q);
    // Only plain Latin-letter input is treated as a transliteration; memo text such as "ノート1巻"
    // or "p.36" would otherwise normalise to "" / "p" and prefix-match far too many lemmas.
    const translit = norm && /^[\p{Script=Latin}\s'-]+$/u.test(q)
      ? [
          like(lemmas.translitPlain, `${norm}%`),
          // Inflected forms by transliteration, e.g. "egeneto" → γίνομαι.
          inArray(
            lemmas.id,
            db.selectDistinct({ id: occurrences.lemmaId }).from(occurrences).where(eq(occurrences.translitPlain, norm)),
          ),
        ]
      : [];
    where = or(...translit, like(lemmas.gloss, `%${q}%`), like(lemmas.glossJa, `%${q}%`), like(lemmaNotes.note, `%${q}%`));
  }

  if (opts.letter) {
    // lemma_plain is accent-free lowercase, so the initial is simply its first character.
    where = and(where, like(lemmas.lemmaPlain, `${normalizeGreek(opts.letter)}%`));
  }
  if (opts.withNote) where = and(where, isNotNull(lemmaNotes.note));

  // Book scope: only lemmas that occur in the book, with counts (and frequency order) within it.
  const book = opts.book ? bookByCode(opts.book) : undefined;
  const bookCounts = book
    ? db
        .select({
          lemmaId: occurrences.lemmaId,
          occ: sql<number>`count(*)`.as("book_occ"),
          verses: sql<number>`count(distinct ${occurrences.chapter} * 1000 + ${occurrences.verse})`.as("book_verses"),
        })
        .from(occurrences)
        .where(eq(occurrences.bookOrd, book.ord))
        .groupBy(occurrences.lemmaId)
        .as("book_counts")
    : null;
  const columns = bookCounts ? { ...listColumns, occurrenceCount: bookCounts.occ, verseCount: bookCounts.verses } : listColumns;
  const scoped = <T extends SQLiteSelect>(qb: T) => {
    qb.leftJoin(lemmaNotes, and(eq(lemmaNotes.strongsId, lemmas.strongsId), eq(lemmaNotes.userId, opts.userId)));
    if (bookCounts) qb.innerJoin(bookCounts, eq(bookCounts.lemmaId, lemmas.id));
    return qb.where(where);
  };

  const order =
    opts.sort === "alpha"
      ? [asc(lemmas.lemmaPlain), asc(lemmas.strongsId)]
      : [desc(bookCounts ? bookCounts.occ : lemmas.occurrenceCount), asc(lemmas.lemmaPlain)];

  const [items, [{ total }]] = await Promise.all([
    scoped(db.select(columns).from(lemmas).$dynamic())
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize) as Promise<LemmaListItem[]>,
    scoped(db.select({ total: sql<number>`count(*)` }).from(lemmas).$dynamic()) as Promise<{ total: number }[]>,
  ]);
  return { items, total, page, pageSize, mode, book: book?.code ?? null };
}

export interface LemmaDetail extends LemmaListItem {
  strongsBase: string;
  lexPos: string | null;
  definitionHtml: string | null;
  books: { code: string; ja: string; en: string; occurrences: number; verses: number }[];
}

export async function getLemmaDetail(db: Db, strongsId: string, userId: string): Promise<LemmaDetail | null> {
  const [row] = await db
    .select({ ...listColumns, strongsBase: lemmas.strongsBase, lexPos: lemmas.lexPos, definitionHtml: lemmaDefinitions.definitionHtml })
    .from(lemmas)
    .leftJoin(lemmaDefinitions, eq(lemmaDefinitions.lemmaId, lemmas.id))
    .leftJoin(lemmaNotes, and(eq(lemmaNotes.strongsId, lemmas.strongsId), eq(lemmaNotes.userId, userId)))
    .where(eq(lemmas.strongsId, strongsId));
  if (!row) return null;
  const byBook = await db
    .select({
      bookOrd: occurrences.bookOrd,
      occurrences: sql<number>`count(*)`,
      verses: sql<number>`count(distinct ${occurrences.chapter} * 1000 + ${occurrences.verse})`,
    })
    .from(occurrences)
    .where(eq(occurrences.lemmaId, row.id))
    .groupBy(occurrences.bookOrd)
    .orderBy(asc(occurrences.bookOrd));
  return {
    ...row,
    books: byBook.map(b => {
      const book = bookByOrd(b.bookOrd)!;
      return { code: book.code, ja: book.ja, en: book.en, occurrences: b.occurrences, verses: b.verses };
    }),
  };
}

export interface Token {
  position: number;
  surface: string;
  transliteration: string | null;
  english: string | null;
  editionInfo: string;
  wordType: string;
  /** One entry per component lemma (more than one only for crasis forms). */
  parts: { lemmaId: number; strongsId: string; lemma: string; gloss: string | null; glossJa: string | null; morphology: string }[];
}

export interface VerseTokens {
  book: string;
  chapter: number;
  verse: number;
  tokens: Token[];
}

type TokenRow = {
  bookOrd: number;
  chapter: number;
  verse: number;
  position: number;
  part: number;
  surface: string;
  transliteration: string | null;
  english: string | null;
  editionInfo: string;
  wordType: string;
  lemmaId: number;
  strongsId: string;
  lemma: string;
  gloss: string | null;
  glossJa: string | null;
  morphology: string;
};

function groupTokens(rows: TokenRow[]): VerseTokens[] {
  const verses: VerseTokens[] = [];
  let cur: VerseTokens | undefined;
  let curOrd = -1;
  for (const r of rows) {
    if (!cur || curOrd !== r.bookOrd || cur.chapter !== r.chapter || cur.verse !== r.verse) {
      curOrd = r.bookOrd;
      cur = { book: bookByOrd(r.bookOrd)!.code, chapter: r.chapter, verse: r.verse, tokens: [] };
      verses.push(cur);
    }
    let tok = cur.tokens[cur.tokens.length - 1];
    if (!tok || tok.position !== r.position) {
      tok = {
        position: r.position,
        surface: r.surface,
        transliteration: r.transliteration,
        english: r.english,
        editionInfo: r.editionInfo,
        wordType: r.wordType,
        parts: [],
      };
      cur.tokens.push(tok);
    }
    tok.parts.push({ lemmaId: r.lemmaId, strongsId: r.strongsId, lemma: r.lemma, gloss: r.gloss, glossJa: r.glossJa, morphology: r.morphology });
  }
  return verses;
}

const tokenColumns = {
  bookOrd: occurrences.bookOrd,
  chapter: occurrences.chapter,
  verse: occurrences.verse,
  position: occurrences.tokenPosition,
  part: occurrences.part,
  surface: occurrences.surfaceForm,
  transliteration: occurrences.transliteration,
  english: occurrences.englishGloss,
  editionInfo: occurrences.editionInfo,
  wordType: occurrences.wordType,
  lemmaId: occurrences.lemmaId,
  strongsId: lemmas.strongsId,
  lemma: lemmas.greekLemma,
  gloss: lemmas.gloss,
  glossJa: lemmas.glossJa,
  morphology: occurrences.morphologyCode,
};

const tokenOrder = [asc(occurrences.bookOrd), asc(occurrences.chapter), asc(occurrences.verse), asc(occurrences.tokenPosition), asc(occurrences.part)];

export interface ConcordancePage {
  lemmaId: number;
  strongsId: string;
  book: string | null;
  /** Number of verses matching (after book filter). */
  totalVerses: number;
  /** Number of occurrences matching (after book filter). */
  totalOccurrences: number;
  page: number;
  pageSize: number;
  verses: (VerseTokens & { hits: number[] })[];
}

export async function getConcordance(
  db: Db,
  opts: { strongsId: string; book?: string | null; page?: number; pageSize?: number },
): Promise<ConcordancePage | null> {
  const [lemma] = await db.select({ id: lemmas.id }).from(lemmas).where(eq(lemmas.strongsId, opts.strongsId));
  if (!lemma) return null;
  const book = opts.book ? bookByCode(opts.book) : undefined;
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 30);
  const page = Math.max(opts.page ?? 1, 1);

  const filter = and(eq(occurrences.lemmaId, lemma.id), book ? eq(occurrences.bookOrd, book.ord) : undefined);

  const [[totals], refs] = await Promise.all([
    db
      .select({
        occ: sql<number>`count(*)`,
        verses: sql<number>`count(distinct ${occurrences.bookOrd} * 1000000 + ${occurrences.chapter} * 1000 + ${occurrences.verse})`,
      })
      .from(occurrences)
      .where(filter),
    db
      .selectDistinct({ bookOrd: occurrences.bookOrd, chapter: occurrences.chapter, verse: occurrences.verse })
      .from(occurrences)
      .where(filter)
      .orderBy(asc(occurrences.bookOrd), asc(occurrences.chapter), asc(occurrences.verse))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  let verses: ConcordancePage["verses"] = [];
  if (refs.length) {
    // Row-value IN over the page's verses (3 bound parameters per verse; pageSize ≤ 30 keeps us under D1's 100).
    const rows = await db
      .select(tokenColumns)
      .from(occurrences)
      .innerJoin(lemmas, eq(lemmas.id, occurrences.lemmaId))
      .where(
        sql`(${occurrences.bookOrd}, ${occurrences.chapter}, ${occurrences.verse}) IN (VALUES ${sql.join(
          refs.map(r => sql`(${r.bookOrd}, ${r.chapter}, ${r.verse})`),
          sql`, `,
        )})`,
      )
      .orderBy(...tokenOrder);
    verses = groupTokens(rows).map(v => ({
      ...v,
      hits: v.tokens.filter(t => t.parts.some(p => p.lemmaId === lemma.id)).map(t => t.position),
    }));
  }

  return {
    lemmaId: lemma.id,
    strongsId: opts.strongsId,
    book: book?.code ?? null,
    totalVerses: totals.verses,
    totalOccurrences: totals.occ,
    page,
    pageSize,
    verses,
  };
}

/** All tokens of a single verse, plus neighbours for navigation. */
export async function getVerseTokens(db: Db, code: string, chapter: number, verse: number): Promise<VerseTokens | null> {
  const book = bookByCode(code);
  if (!book) return null;
  const rows = await db
    .select(tokenColumns)
    .from(occurrences)
    .innerJoin(lemmas, eq(lemmas.id, occurrences.lemmaId))
    .where(and(eq(occurrences.bookOrd, book.ord), eq(occurrences.chapter, chapter), eq(occurrences.verse, verse)))
    .orderBy(...tokenOrder);
  return groupTokens(rows)[0] ?? null;
}

export interface VerseNeighbours {
  prev: { book: string; chapter: number; verse: number } | null;
  next: { book: string; chapter: number; verse: number } | null;
}

export async function getVerseNeighbours(db: Db, code: string, chapter: number, verse: number): Promise<VerseNeighbours> {
  const book = bookByCode(code);
  if (!book) return { prev: null, next: null };
  const key = sql`(${occurrences.bookOrd}, ${occurrences.chapter}, ${occurrences.verse})`;
  const here = sql`(${book.ord}, ${chapter}, ${verse})`;
  const cols = { bookOrd: occurrences.bookOrd, chapter: occurrences.chapter, verse: occurrences.verse };
  const [prev, next] = await Promise.all([
    db.select(cols).from(occurrences).where(sql`${key} < ${here}`).orderBy(desc(occurrences.bookOrd), desc(occurrences.chapter), desc(occurrences.verse)).limit(1),
    db.select(cols).from(occurrences).where(sql`${key} > ${here}`).orderBy(asc(occurrences.bookOrd), asc(occurrences.chapter), asc(occurrences.verse)).limit(1),
  ]);
  const toRef = (r?: { bookOrd: number; chapter: number; verse: number }) =>
    r ? { book: bookByOrd(r.bookOrd)!.code, chapter: r.chapter, verse: r.verse } : null;
  return { prev: toRef(prev[0]), next: toRef(next[0]) };
}

export { BOOKS };

export const NOTE_MAX_LENGTH = 200;

/** Saves the one-line memo for a lemma; an empty memo deletes it. Returns the stored value. */
export async function saveLemmaNote(db: Db, userId: string, strongsId: string, raw: string): Promise<string | null> {
  const [lemma] = await db.select({ id: lemmas.id }).from(lemmas).where(eq(lemmas.strongsId, strongsId));
  if (!lemma) throw new Error(`Unknown lemma ${strongsId}`);
  const note = raw.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX_LENGTH);
  if (!note) {
    await db.delete(lemmaNotes).where(and(eq(lemmaNotes.userId, userId), eq(lemmaNotes.strongsId, strongsId)));
    return null;
  }
  const updatedAt = new Date().toISOString();
  await db
    .insert(lemmaNotes)
    .values({ userId, strongsId, note, updatedAt })
    .onConflictDoUpdate({ target: [lemmaNotes.userId, lemmaNotes.strongsId], set: { note, updatedAt } });
  return note;
}

const SCOPE_BOOK_KEY = "scope_book";

/** The user's book chosen in the header (stored in D1), or null for the whole NT. */
export async function getScopeBook(db: Db, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ value: userSettings.value })
    .from(userSettings)
    .where(and(eq(userSettings.userId, userId), eq(userSettings.key, SCOPE_BOOK_KEY)));
  return row && bookByCode(row.value) ? row.value : null;
}

export async function setScopeBook(db: Db, userId: string, code: string | null): Promise<string | null> {
  const book = code ? bookByCode(code) : undefined;
  if (!book) {
    await db.delete(userSettings).where(and(eq(userSettings.userId, userId), eq(userSettings.key, SCOPE_BOOK_KEY)));
    return null;
  }
  const updatedAt = new Date().toISOString();
  await db
    .insert(userSettings)
    .values({ userId, key: SCOPE_BOOK_KEY, value: book.code, updatedAt })
    .onConflictDoUpdate({ target: [userSettings.userId, userSettings.key], set: { value: book.code, updatedAt } });
  return book.code;
}
