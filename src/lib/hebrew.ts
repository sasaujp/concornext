/**
 * Hebrew text helpers.
 *
 * TAHOT Hebrew carries vowel points (niqqud) and cantillation accents. For searching we keep only the
 * consonants, with final forms folded to their regular forms so that a prefix such as "מלכ" matches מֶלֶךְ.
 */

const FINAL_FORMS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Consonants only: no points, accents or punctuation (maqqef, sof pasuq, paseq), final forms folded. */
export function normalizeHebrew(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^א-ת]/g, "")
    .replace(/[ךםןףץ]/g, c => FINAL_FORMS[c]);
}

export function containsHebrew(s: string): boolean {
  return /[א-ת]/.test(s);
}

/** Hebrew without punctuation marks around the word (maqqef ־, sof pasuq ׃, paseq ׀, section marks ס/פ after a space). */
export function stripHebrewPunctuation(word: string): string {
  return word.replace(/[־׀׃׆]|\s+[ספ]$/g, "").trim();
}

/** The 22 letters, for the initial-letter buttons. */
export const HEBREW_ALPHABET = [..."אבגדהוזחטיכלמנסעפצקרשת"];
