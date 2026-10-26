import { action, query } from "@solidjs/router";
import {
  deletePasskey,
  fetchAccount,
  fetchAppInfo,
  fetchMe,
  fetchBsb,
  fetchCachedAnalysis,
  fetchConcordance,
  fetchLemmaDetail,
  fetchLemmaList,
  fetchVerse,
  generateAnalysis,
  fetchScopeBook,
  updateLemmaNote,
  updateScopeBook,
} from "~/server/api";

export const lemmaListQuery = query(fetchLemmaList, "lemma-list");
export const lemmaDetailQuery = query(fetchLemmaDetail, "lemma-detail");
export const concordanceQuery = query(fetchConcordance, "concordance");
export const bsbQuery = query(fetchBsb, "bsb");
export const verseQuery = query(fetchVerse, "verse");
export const cachedAnalysisQuery = query(fetchCachedAnalysis, "cached-analysis");
export const appInfoQuery = query(fetchAppInfo, "app-info");
export const analyzeAction = action(generateAnalysis, "analyze");
export const saveNoteAction = action(updateLemmaNote, "save-note");
/** Book chosen in the header; stored in D1 (app_settings). */
export const scopeBookQuery = query(fetchScopeBook, "scope-book");
export const setScopeBookAction = action(updateScopeBook, "set-scope-book");

export type { AnalysisRequest, AnalysisResponse } from "~/server/analysis";
export type { ConcordancePage, LemmaDetail, LemmaListItem, LemmaSearchResult, Token, VerseTokens } from "~/server/lexicon";

/** Signed-in user or null. */
export const meQuery = query(fetchMe, "me");
export const accountQuery = query(fetchAccount, "account");
export const deletePasskeyAction = action(deletePasskey, "delete-passkey");
