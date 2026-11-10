/**
 * Attributes for text in an original language: Greek (polytonic serif) or Hebrew/Aramaic
 * (pointed serif, right-to-left). `dir="rtl"` on an inline element also isolates it from the
 * surrounding Japanese/English text, so punctuation and numbers stay in place.
 */
import { containsHebrew } from "./hebrew";

export interface ScriptAttrs {
  class: string;
  lang: string;
  dir?: "rtl";
}

export function isHebrewText(text: string | null | undefined): boolean {
  return !!text && containsHebrew(text);
}

/** `<span {...scriptAttrs(word, "text-xl")}>` — script class, lang and direction for `text`, plus extra classes. */
export function scriptAttrs(text: string | null | undefined, extraClass = ""): ScriptAttrs {
  const cls = (base: string) => (extraClass ? `${base} ${extraClass}` : base);
  return isHebrewText(text) ? { class: cls("hebrew"), lang: "he", dir: "rtl" } : { class: cls("greek"), lang: "grc" };
}

/** A word as a headword-like form: no Greek punctuation/¶, no Hebrew maqqef, sof pasuq, paseq or section marks. */
export function bareWord(surface: string): string {
  return surface
    .replace(/[¶,.;·:]+/g, "")
    .replace(/[־׀׃׆]/g, "")
    .replace(/\s+[ספ]$/, "")
    .trim();
}

/** Hebrew strongsIds start with H; the rest of the app is Greek. */
export const isHebrewStrongs = (strongsId: string) => strongsId.startsWith("H");
