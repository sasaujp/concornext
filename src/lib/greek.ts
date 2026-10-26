/**
 * Accent-insensitive normalisation for polytonic Greek.
 * Strips all combining marks (accents, breathings, iota subscript, diaeresis),
 * lowercases, folds final sigma, and removes punctuation/apostrophes.
 */
export function normalizeGreek(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ᷀-᷿]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/ς/g, "σ")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Removes trailing/leading punctuation that TAGNT attaches to a surface form. */
export function stripPunctuation(word: string): string {
  return word.replace(/^[^\p{L}]+|[^\p{L}᾽’ʼ]+$/gu, "");
}

const GREEK_RE = /[Ͱ-Ͽἀ-῿]/;

export function containsGreek(s: string): boolean {
  return GREEK_RE.test(s);
}

/** Normalises user input like "3056", "g3056", "G03056", "G2491G" to TAGNT form ("G3056", "G2491G"). */
export function parseStrongs(input: string): { base: string; extended: string | null } | null {
  const m = input.trim().match(/^g?\s*0*(\d{1,5})([a-z])?$/i);
  if (!m) return null;
  const base = `G${m[1].padStart(4, "0")}`;
  return { base, extended: m[2] ? base + m[2].toUpperCase() : null };
}

/**
 * Search key for Latin transliterations: lowercase, diacritics stripped (ē → e) and every "h" removed.
 * Dropping "h" makes rough breathing and aspirates spelling-insensitive, so "houtos" matches
 * TAGNT's "ohutos" and "christos"/"cristos" coincide; both sides are normalised the same way.
 */
export function normalizeLatin(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/h/g, "");
}

/** The 24 letters in dictionary order, with their (accent-free, lowercase) search key and name. */
export const GREEK_ALPHABET = [
  ["α", "Α", "alpha"], ["β", "Β", "beta"], ["γ", "Γ", "gamma"], ["δ", "Δ", "delta"],
  ["ε", "Ε", "epsilon"], ["ζ", "Ζ", "zeta"], ["η", "Η", "eta"], ["θ", "Θ", "theta"],
  ["ι", "Ι", "iota"], ["κ", "Κ", "kappa"], ["λ", "Λ", "lambda"], ["μ", "Μ", "mu"],
  ["ν", "Ν", "nu"], ["ξ", "Ξ", "xi"], ["ο", "Ο", "omicron"], ["π", "Π", "pi"],
  ["ρ", "Ρ", "rho"], ["σ", "Σ", "sigma"], ["τ", "Τ", "tau"], ["υ", "Υ", "upsilon"],
  ["φ", "Φ", "phi"], ["χ", "Χ", "chi"], ["ψ", "Ψ", "psi"], ["ω", "Ω", "omega"],
].map(([key, upper, name]) => ({ key, upper, name }));

export function isGreekInitial(s: string): boolean {
  return GREEK_ALPHABET.some(l => l.key === s);
}
