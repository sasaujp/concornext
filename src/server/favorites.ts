/** Each user's favourite verses and their memos (free text, may span several lines). */
import { and, eq } from "drizzle-orm";
import { verseFavorites } from "~/db/schema";
import { bookByCode } from "~/lib/books";
import type { Db } from "./db";

export const FAVORITE_NOTE_MAX_LENGTH = 4000;

export interface Favorite {
  book: string;
  chapter: number;
  verse: number;
  note: string | null;
  createdAt: string;
}

/** All of the user's favourites in Bible order. */
export async function listFavorites(db: Db, userId: string): Promise<Favorite[]> {
  const rows = await db
    .select({ book: verseFavorites.book, chapter: verseFavorites.chapter, verse: verseFavorites.verse, note: verseFavorites.note, createdAt: verseFavorites.createdAt })
    .from(verseFavorites)
    .where(eq(verseFavorites.userId, userId));
  const ord = (code: string) => bookByCode(code)?.ord ?? 99;
  return rows.sort((a, b) => ord(a.book) - ord(b.book) || a.chapter - b.chapter || a.verse - b.verse);
}

function checkRef(book: string, chapter: number, verse: number) {
  if (!bookByCode(book) || !Number.isInteger(chapter) || !Number.isInteger(verse) || chapter < 1 || verse < 1) {
    throw new Error(`Invalid verse ${book}.${chapter}.${verse}`);
  }
}

const keyOf = (userId: string, book: string, chapter: number, verse: number) =>
  and(eq(verseFavorites.userId, userId), eq(verseFavorites.book, book), eq(verseFavorites.chapter, chapter), eq(verseFavorites.verse, verse));

/** Adds or removes a favourite. Removing also discards its memo. */
export async function setFavorite(db: Db, userId: string, book: string, chapter: number, verse: number, on: boolean): Promise<void> {
  checkRef(book, chapter, verse);
  if (!on) {
    await db.delete(verseFavorites).where(keyOf(userId, book, chapter, verse));
    return;
  }
  const now = new Date().toISOString();
  await db.insert(verseFavorites).values({ userId, book, chapter, verse, note: null, createdAt: now, updatedAt: now }).onConflictDoNothing();
}

/** Saves the memo of a verse (favouriting it if needed); an empty memo clears the memo but keeps the favourite. */
export async function saveFavoriteNote(db: Db, userId: string, book: string, chapter: number, verse: number, raw: string): Promise<string | null> {
  checkRef(book, chapter, verse);
  // Keep line breaks; drop trailing spaces on each line and blank lines at either end.
  const note =
    raw
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+$/gm, "")
      .replace(/^\n+|\n+$/g, "")
      .slice(0, FAVORITE_NOTE_MAX_LENGTH) || null;
  const now = new Date().toISOString();
  await db
    .insert(verseFavorites)
    .values({ userId, book, chapter, verse, note, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [verseFavorites.userId, verseFavorites.book, verseFavorites.chapter, verseFavorites.verse],
      set: { note, updatedAt: now },
    });
  return note;
}
