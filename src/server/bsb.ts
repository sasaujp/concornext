/**
 * Berean Standard Bible text from the Free Use Bible API (bible.helloao.org),
 * fetched one chapter at a time and cached in D1. Failures never block the Greek data:
 * callers get `null` for verses that could not be loaded.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { chapterFetches, verseCache } from "~/db/schema";
import { bookByCode } from "~/lib/books";
import type { Db } from "./db";

export const TRANSLATION = "BSB";
const API_BASE = "https://bible.helloao.org/api";
const FETCH_TIMEOUT_MS = 6000;
/** Upper bound on chapter downloads per request (Workers subrequest budget). */
const MAX_CHAPTER_FETCHES = 12;

interface SimpleChapter {
  chapter: { number: number; content: ({ type: "verse"; number: number; text: string } | { type: string })[] };
}

export interface VerseRefInput {
  book: string;
  chapter: number;
  verse: number;
}

export interface BsbResult {
  /** "Jhn.1.1" → text (null if unavailable). */
  verses: Record<string, string | null>;
  /** Set when the API could not be reached for at least one chapter. */
  error: string | null;
}

const key = (r: VerseRefInput) => `${r.book}.${r.chapter}.${r.verse}`;

async function fetchChapter(book: string, chapter: number): Promise<Map<number, string>> {
  const usfm = bookByCode(book)?.usfm;
  if (!usfm) throw new Error(`Unknown book ${book}`);
  const res = await fetch(`${API_BASE}/${TRANSLATION}/${usfm}/${chapter}.simple.json`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`BSB API ${res.status} for ${usfm} ${chapter}`);
  const json = (await res.json()) as SimpleChapter;
  const out = new Map<number, string>();
  for (const item of json.chapter.content) {
    if (item.type === "verse" && "text" in item) out.set(item.number, item.text.trim());
  }
  return out;
}

async function storeChapter(db: Db, book: string, chapter: number, verses: Map<number, string>) {
  const now = new Date().toISOString();
  const rows = [...verses].map(([verse, text]) => ({ translation: TRANSLATION, book, chapter, verse, text, fetchedAt: now }));
  // 6 columns per row → at most 16 rows per statement under D1's 100-parameter limit.
  const stmts = [];
  for (let i = 0; i < rows.length; i += 16) {
    stmts.push(db.insert(verseCache).values(rows.slice(i, i + 16)).onConflictDoNothing());
  }
  stmts.push(db.insert(chapterFetches).values({ translation: TRANSLATION, book, chapter, fetchedAt: now }).onConflictDoNothing());
  await db.batch(stmts as [(typeof stmts)[number], ...typeof stmts]);
}

export async function getBsbVerses(db: Db, refs: VerseRefInput[]): Promise<BsbResult> {
  const result: BsbResult = { verses: {}, error: null };
  if (!refs.length) return result;

  const chapters = new Map<string, { book: string; chapter: number }>();
  for (const r of refs) chapters.set(`${r.book}.${r.chapter}`, { book: r.book, chapter: r.chapter });

  const books = [...new Set(refs.map(r => r.book))];
  const [cached, fetched] = await Promise.all([
    db
      .select({ book: verseCache.book, chapter: verseCache.chapter, verse: verseCache.verse, text: verseCache.text })
      .from(verseCache)
      .where(
        and(
          eq(verseCache.translation, TRANSLATION),
          inArray(verseCache.book, books),
          sql`(${verseCache.book} || '.' || ${verseCache.chapter}) IN (${sql.join(
            [...chapters.keys()].map(k => sql`${k}`),
            sql`, `,
          )})`,
        ),
      ),
    db
      .select({ book: chapterFetches.book, chapter: chapterFetches.chapter })
      .from(chapterFetches)
      .where(and(eq(chapterFetches.translation, TRANSLATION), inArray(chapterFetches.book, books))),
  ]);

  const texts = new Map<string, string>();
  for (const c of cached) texts.set(key(c), c.text);
  const done = new Set(fetched.map(f => `${f.book}.${f.chapter}`));

  const missing = [...chapters].filter(([k]) => !done.has(k)).map(([, v]) => v);
  const toFetch = missing.slice(0, MAX_CHAPTER_FETCHES);
  const errors: string[] = [];
  if (missing.length > toFetch.length) errors.push(`${missing.length - toFetch.length} 章分は次回の表示時に取得します`);

  await Promise.all(
    toFetch.map(async ({ book, chapter }) => {
      try {
        const verses = await fetchChapter(book, chapter);
        for (const [v, text] of verses) texts.set(`${book}.${chapter}.${v}`, text);
        await storeChapter(db, book, chapter, verses);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }),
  );

  for (const r of refs) result.verses[key(r)] = texts.get(key(r)) ?? null;
  if (errors.length) result.error = errors.join("; ");
  return result;
}
