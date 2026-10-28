/** URL search-param state for the lexicon page, so every selection is restorable from the URL. */
import { isGreekInitial } from "~/lib/greek";
import type { LemmaSort } from "~/server/lexicon";

export type LexiconParams = {
  q?: string;
  sort?: string;
  /** Initial letter filter (accent-free lowercase Greek letter, e.g. "λ"). */
  l?: string;
  /** "1" = only lemmas that have a memo. */
  memo?: string;
  page?: string;
  s?: string;
  book?: string;
  cp?: string;
};

export interface LexiconState {
  q: string;
  sort: LemmaSort;
  letter: string | null;
  memo: boolean;
  page: number;
  s: string | null;
  book: string | null;
  cp: number;
}

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string | string[] | undefined) => Math.max(1, Number.parseInt(str(v), 10) || 1);

/** Alphabetical by default; with the memo filter on, memo order (memo text, ascending). */
export function defaultSort(memo: boolean): LemmaSort {
  return memo ? "memo" : "alpha";
}

export function readParams(p: Partial<Record<keyof LexiconParams, string | string[]>>): LexiconState {
  const memo = str(p.memo) === "1";
  const sort = str(p.sort);
  return {
    q: str(p.q),
    sort: sort === "freq" || sort === "alpha" || (sort === "memo" && memo) ? sort : defaultSort(memo),
    letter: isGreekInitial(str(p.l)) ? str(p.l) : null,
    memo,
    page: num(p.page),
    s: str(p.s) || null,
    book: str(p.book) || null,
    cp: num(p.cp),
  };
}

export function lexiconHref(state: LexiconState, patch: Partial<LexiconState> = {}): string {
  const s = { ...state, ...patch };
  const u = new URLSearchParams();
  if (s.q) u.set("q", s.q);
  if (s.sort !== defaultSort(s.memo)) u.set("sort", s.sort);
  if (s.letter) u.set("l", s.letter);
  if (s.memo) u.set("memo", "1");
  if (s.page > 1) u.set("page", String(s.page));
  if (s.s) u.set("s", s.s);
  if (s.book) u.set("book", s.book);
  if (s.cp > 1) u.set("cp", String(s.cp));
  const qs = u.toString();
  return qs ? `/?${qs}` : "/";
}

export function verseHref(ref: { book: string; chapter: number; verse: number }, opts: { s?: string | null; w?: number | null; from?: string | null } = {}) {
  const u = new URLSearchParams();
  if (opts.s) u.set("s", opts.s);
  if (opts.w) u.set("w", String(opts.w));
  if (opts.from) u.set("from", opts.from);
  const qs = u.toString();
  return `/verse/${ref.book}.${ref.chapter}.${ref.verse}${qs ? `?${qs}` : ""}`;
}

/** Only allow same-site relative return paths. */
export function safeReturnPath(from: string | undefined | null): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  return from;
}

/** Passage reader. `r` is a passage ("Jhn.1.1-18"); `at` is the selected word as "chapter.verse.position". */
export type PassageParams = { r?: string; at?: string; en?: string };

export function passageHref(r: string | null, opts: { at?: string | null; en?: boolean } = {}) {
  const u = new URLSearchParams();
  if (r) u.set("r", r);
  if (opts.at) u.set("at", opts.at);
  if (opts.en === false) u.set("en", "0");
  const qs = u.toString();
  return `/passage${qs ? `?${qs}` : ""}`;
}
