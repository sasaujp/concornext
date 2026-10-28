import { action, json, query } from "@solidjs/router";
import {
  deletePasskey,
  fetchAccount,
  fetchAppInfo,
  fetchMe,
  fetchBsb,
  fetchCachedAnalysis,
  fetchConcordance,
  fetchFavorites,
  fetchLemmaDetail,
  fetchLemmaList,
  fetchOutline,
  fetchPassage,
  fetchVerse,
  fetchVersesTokens,
  generateAnalysis,
  fetchScopeBook,
  updateFavorite,
  updateFavoriteNote,
  updateLemmaNote,
  updateScopeBook,
} from "~/server/api";

export const lemmaListQuery = query(fetchLemmaList, "lemma-list");
export const lemmaDetailQuery = query(fetchLemmaDetail, "lemma-detail");
export const concordanceQuery = query(fetchConcordance, "concordance");
export const bsbQuery = query(fetchBsb, "bsb");
export const verseQuery = query(fetchVerse, "verse");
export const passageQuery = query(fetchPassage, "passage");
/** Verses per chapter for every book (for the passage picker). */
export const outlineQuery = query(fetchOutline, "outline");
export const cachedAnalysisQuery = query(fetchCachedAnalysis, "cached-analysis");
export const appInfoQuery = query(fetchAppInfo, "app-info");
export const analyzeAction = action(generateAnalysis, "analyze");
export const saveNoteAction = action(updateLemmaNote, "save-note");
/** Book chosen in the header; stored in D1 (app_settings). */
export const scopeBookQuery = query(fetchScopeBook, "scope-book");
export const setScopeBookAction = action(updateScopeBook, "set-scope-book");

/** The user's favourite verses (with memos), in Bible order. */
export const favoritesQuery = query(fetchFavorites, "favorites");
export const versesTokensQuery = query(fetchVersesTokens, "verses-tokens");
// Favourite changes only touch the favourites list, so revalidate just that (not the open passage/concordance).
export const setFavoriteAction = action(async (book: string, chapter: number, verse: number, on: boolean) => {
  await updateFavorite(book, chapter, verse, on);
  return json(null, { revalidate: favoritesQuery.key });
}, "set-favorite");
export const saveFavoriteNoteAction = action(async (book: string, chapter: number, verse: number, note: string) => {
  const saved = await updateFavoriteNote(book, chapter, verse, note);
  return json(saved, { revalidate: favoritesQuery.key });
}, "save-favorite-note");

export type { AnalysisRequest, AnalysisResponse } from "~/server/analysis";
export type { Favorite } from "~/server/favorites";
export type { ConcordancePage, LemmaDetail, LemmaListItem, LemmaSearchResult, PassageTokens, Token, VerseTokens } from "~/server/lexicon";

/** Signed-in user or null. */
export const meQuery = query(fetchMe, "me");
export const accountQuery = query(fetchAccount, "account");
export const deletePasskeyAction = action(deletePasskey, "delete-passkey");
