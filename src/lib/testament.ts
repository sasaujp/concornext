/**
 * Which testament the user is looking at, for the header's per-testament book.
 * Lexicon page: the 新約／旧約 switch (?t=ot) or the open lemma; verse and passage pages: the book shown.
 * Pages without a book (favourites, account) keep the testament last seen.
 */
import { useLocation, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal } from "solid-js";
import { parsePassage, parseRef, type Testament } from "~/lib/books";

export const testamentOfStrongs = (strongsId: string): Testament => (strongsId.startsWith("H") ? "OT" : "NT");

const [lastTestament, setLastTestament] = createSignal<Testament>("NT");

export function useCurrentTestament(): () => Testament {
  const location = useLocation();
  const [search] = useSearchParams<{ t?: string; s?: string; r?: string }>();
  const fromPage = (): Testament | null => {
    const path = location.pathname;
    if (path === "/") return search.t === "ot" || (typeof search.s === "string" && search.s.startsWith("H")) ? "OT" : "NT";
    if (path.startsWith("/verse/")) return parseRef(decodeURIComponent(path.slice("/verse/".length)))?.book.testament ?? null;
    if (path === "/passage" && typeof search.r === "string") return parsePassage(search.r)?.book.testament ?? null;
    return null;
  };
  createEffect(() => {
    const t = fromPage();
    if (t) setLastTestament(t);
  });
  return () => fromPage() ?? lastTestament();
}
