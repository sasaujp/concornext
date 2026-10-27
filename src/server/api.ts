"use server";
/**
 * Server functions (RPC endpoints). Everything here runs inside the Worker.
 * All of them require a signed-in user (resolved by src/middleware.ts) except fetchMe.
 */
import { env } from "cloudflare:workers";
import { getRequestEvent } from "solid-js/web";
import { dataVersions } from "~/db/schema";
import { analysisModel, getCachedAnalysis, PROMPT_VERSION, runAnalysis, type AnalysisRequest } from "./analysis";
import { listPasskeys, removePasskey, type SessionUser } from "./auth";
import { getBsbVerses, type VerseRefInput } from "./bsb";
import { getDb } from "./db";
import {
  getConcordance,
  getLemmaDetail,
  getScopeBook,
  getVerseNeighbours,
  getVerseTokens,
  saveLemmaNote,
  searchLemmas,
  setScopeBook,
  type LemmaSort,
} from "./lexicon";

function currentUser(): SessionUser | null {
  return getRequestEvent()?.locals.user ?? null;
}

function requireUser(): SessionUser {
  const user = currentUser();
  if (!user) throw new Error("ログインが必要です。");
  return user;
}

/** The signed-in user, or null (public: used by the login page and header). */
export async function fetchMe() {
  return currentUser();
}

export async function fetchLemmaList(q: string, sort: LemmaSort, letter: string | null, withNote: boolean, book: string | null, page: number) {
  const user = requireUser();
  return searchLemmas(getDb(), { userId: user.id, q, sort, letter, withNote, book, page, pageSize: 50 });
}

export async function fetchScopeBook() {
  return getScopeBook(getDb(), requireUser().id);
}

export async function updateScopeBook(code: string | null) {
  return setScopeBook(getDb(), requireUser().id, code);
}

export async function updateLemmaNote(strongsId: string, book: string, note: string) {
  return saveLemmaNote(getDb(), requireUser().id, book, strongsId, note);
}

export async function fetchLemmaDetail(strongsId: string) {
  return getLemmaDetail(getDb(), strongsId, requireUser().id);
}

export async function fetchConcordance(strongsId: string, book: string | null, page: number) {
  requireUser();
  return getConcordance(getDb(), { strongsId, book, page, pageSize: 20 });
}

export async function fetchBsb(refs: VerseRefInput[]) {
  requireUser();
  return getBsbVerses(getDb(), refs.slice(0, 40));
}

export async function fetchVerse(book: string, chapter: number, verse: number) {
  requireUser();
  const db = getDb();
  const [tokens, neighbours] = await Promise.all([getVerseTokens(db, book, chapter, verse), getVerseNeighbours(db, book, chapter, verse)]);
  return tokens ? { ...tokens, ...neighbours } : null;
}

export async function fetchCachedAnalysis(req: AnalysisRequest) {
  requireUser();
  return getCachedAnalysis(getDb(), req);
}

export async function generateAnalysis(req: AnalysisRequest) {
  requireUser();
  return runAnalysis(getDb(), req);
}

export async function fetchAppInfo() {
  requireUser();
  const versions = await getDb().select().from(dataVersions);
  return {
    hasApiKey: !!env.ANTHROPIC_API_KEY,
    model: analysisModel(),
    promptVersion: PROMPT_VERSION,
    dataVersions: versions,
  };
}

export async function fetchAccount() {
  const user = requireUser();
  return { user, passkeys: await listPasskeys(getDb(), user.id) };
}

export async function deletePasskey(passkeyId: string) {
  const user = requireUser();
  try {
    await removePasskey(getDb(), user.id, passkeyId);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
