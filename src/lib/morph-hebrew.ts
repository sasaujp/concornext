/**
 * Decoder for the Hebrew/Aramaic morphology codes used by STEPBible TAHOT (TEHMC – Translators Expansion
 * of Hebrew Morphology Codes; based on the OpenScriptures/ETCBC scheme). A code is the language (H/A)
 * followed by one segment's grammar, e.g. HVqp3ms, HNcfsa, HTd, ASp3mp.
 *
 *   V stem form [person gender number | gender number state]   verb
 *   N type gender number state                                  noun (Np + m/f/l/t for names)
 *   A type gender number state                                  adjective / numeral
 *   P type person gender number                                 pronoun
 *   S type person gender number                                 suffix
 *   T type, R[d], C, D                                          particle, preposition, conjunction, adverb
 *
 * Labels are Japanese; stems keep their conventional names (Qal, Piel …). tests/morph-hebrew.test.ts checks
 * every code that occurs in TAHOT against TEHMC's own expansion.
 */

export interface HebrewMorphology {
  code: string;
  language: "hbo" | "arc";
  pos: string;
  /** Verb stem (binyan), e.g. "Qal", "Hiphil", "Peal". */
  stem?: string;
  /** Verb form, e.g. "完了", "ワイイクトル（継続未完了）", "分詞". */
  form?: string;
  person?: string;
  gender?: string;
  number?: string;
  state?: string;
  /** Sub-type of nouns, pronouns, particles … (e.g. "固有名詞", "人称", "冠詞"). */
  kind?: string;
  /** English values in TEHMC's terms, for checking against the source. */
  en: { function: string; stem?: string; form?: string; person?: string; gender?: string; number?: string; state?: string };
}

const POS: Record<string, [string, string]> = {
  V: ["動詞", "Verb"],
  N: ["名詞", "Noun"],
  A: ["形容詞", "Adjective"],
  P: ["代名詞", "Pronoun"],
  R: ["前置詞", "Preposition"],
  C: ["接続詞", "Conjunction"],
  c: ["接続詞", "Conjunction"],
  D: ["副詞", "Adverb"],
  T: ["不変化詞", "Particle"],
  S: ["接尾辞", "Suffix"],
};

const HEBREW_STEMS: Record<string, string> = {
  q: "Qal", N: "Niphal", p: "Piel", P: "Pual", h: "Hiphil", H: "Hophal", t: "Hithpael", o: "Polel", O: "Polal",
  r: "Hithpolel", m: "Poel", M: "Poal", k: "Palel", K: "Pulal", Q: "Qal passive", l: "Pilpel", L: "Polpal",
  f: "Hithpalpel", D: "Nithpael", j: "Pealal", i: "Pilel", u: "Hothpaal", c: "Tiphil", v: "Hishtaphel",
  w: "Nithpalel", y: "Nithpoel", z: "Hithpoel",
};
const ARAMAIC_STEMS: Record<string, string> = {
  q: "Peal", Q: "Peil", u: "Hitpael", p: "Pael", P: "Hitpeel", M: "Hitpaal", a: "Aphel", h: "Haphel", s: "Saphel",
  e: "Shaphel", H: "Hophal", i: "Hitpeel", t: "Hishtaphel", v: "Ishtaphel", w: "Hithaphel", o: "Polel", z: "Ithpoel",
  r: "Hithpolel", f: "Hithpalpel", b: "Hephal", c: "Tiphel", m: "Poel", l: "Palpel", L: "Ithpalpel", O: "Ithpolel",
  G: "Ittaphal",
};

// Verb forms. "c" is the cohortative when a person follows, else the infinitive construct.
const FORMS: Record<string, [string, string]> = {
  p: ["完了", "Perfect"],
  q: ["ウェカータル（継続完了）", "Consecutive Perfect"],
  i: ["未完了", "Imperfect"],
  n: ["未完了（直説）", "Imperfect"],
  j: ["未完了（指示形）", "Imperfect"],
  h: ["未完了（願望形）", "Imperfect"],
  u: ["ウェイクトル（ワウ＋未完了）", "Conjunction+Imperfect"],
  w: ["ワイイクトル（継続未完了）", "Consecutive Imperfect"],
  v: ["命令形", "Imperative"],
  r: ["分詞", "Participle"],
  s: ["受動分詞", "Participle passive"],
  a: ["不定詞独立形", "Infinitive"],
};

const PERSON: Record<string, [string, string]> = { "1": ["1人称", "First"], "2": ["2人称", "Second"], "3": ["3人称", "Third"] };
const GENDER: Record<string, [string, string]> = {
  m: ["男性", "Masculine"],
  f: ["女性", "Feminine"],
  c: ["通性", "Either gender"],
  b: ["通性", "Either gender"],
  l: ["地名", "Location"],
  t: ["称号", "Title"],
};
const NUMBER: Record<string, [string, string]> = { s: ["単数", "Singular"], p: ["複数", "Plural"], d: ["双数", "Dual"] };
const STATE: Record<string, [string, string]> = { a: ["絶対形", "Absolute"], c: ["連語形", "Construct"], d: ["限定形", "Definite"] };

const NOUN_KIND: Record<string, string> = { c: "普通名詞", g: "民族名", p: "固有名詞", t: "称号" };
const ADJ_KIND: Record<string, string> = { a: "形容詞", c: "数詞（基数）", o: "数詞（序数）", g: "民族名" };
const PRONOUN_KIND: Record<string, string> = { d: "指示", f: "不定", i: "疑問", p: "人称", r: "関係" };
const SUFFIX_KIND: Record<string, string> = { d: "方向のヘー", h: "付加のヘー", n: "付加のヌン", p: "人称接尾辞" };
const PARTICLE_KIND: Record<string, string> = {
  a: "肯定", c: "条件", d: "冠詞", e: "勧告", i: "疑問", j: "間投詞", m: "指示", n: "否定", o: "目的語標識", r: "関係",
};

/** True for a TEHMC code (language H/A followed by a part-of-speech letter). */
export function isHebrewMorphology(code: string): boolean {
  return /^[HA][VNAPRCcDTS]/.test(code);
}

export function decodeHebrewMorphology(code: string): HebrewMorphology {
  const language = code[0] === "A" ? "arc" : "hbo";
  const g = code.slice(1);
  const p = g[0] ?? "";
  const [pos, fn] = POS[p] ?? ["不明", "Unknown"];
  const m: HebrewMorphology = { code, language, pos, en: { function: fn } };
  const set = (field: "person" | "gender" | "number" | "state", table: Record<string, [string, string]>, ch: string | undefined) => {
    const v = ch ? table[ch] : undefined;
    if (v) {
      m[field] = v[0];
      m.en[field] = v[1];
    }
  };
  const pgn = (s: string) => {
    set("person", PERSON, s[0]);
    set("gender", GENDER, s[1]);
    set("number", NUMBER, s[2]);
  };
  const gns = (s: string) => {
    set("gender", GENDER, s[0]);
    set("number", NUMBER, s[1]);
    set("state", STATE, s[2]);
  };

  switch (p) {
    case "V": {
      const stem = (language === "arc" ? ARAMAIC_STEMS : HEBREW_STEMS)[g[1]];
      if (stem) m.stem = m.en.stem = stem;
      const f = g[2];
      const rest = g.slice(3);
      if (f === "c") {
        // Cohortative imperfect (with person) or infinitive construct (without).
        if (/^[123]/.test(rest)) {
          [m.form, m.en.form] = ["未完了（願望形）", "Imperfect"];
          pgn(rest);
        } else {
          [m.form, m.en.form] = ["不定詞連語形", "Infinitive"];
          set("state", STATE, rest[0]);
        }
      } else if (f && FORMS[f]) {
        [m.form, m.en.form] = FORMS[f];
        if (f === "r" || f === "s") gns(rest);
        else if (f === "a") set("state", STATE, rest[0]);
        else pgn(rest);
      }
      break;
    }
    case "N":
      m.kind = NOUN_KIND[g[1]];
      // Names: Npm (person, male), Npf, Npl (place), Npt (title) – no number/state.
      if (g[1] === "p") set("gender", GENDER, g[2]);
      else gns(g.slice(2));
      break;
    case "A":
      m.kind = ADJ_KIND[g[1]];
      gns(g.slice(2));
      break;
    case "P":
      m.kind = PRONOUN_KIND[g[1]];
      pgn(g.slice(2));
      break;
    case "S":
      m.kind = SUFFIX_KIND[g[1]];
      if (g[1] === "p") pgn(g.slice(2));
      break;
    case "T":
      m.kind = PARTICLE_KIND[g[1]];
      break;
    case "R":
      if (g[1] === "d") m.kind = "冠詞付き";
      break;
    case "c":
      m.kind = "ワイイクトルのワウ";
      break;
  }
  return m;
}

/** One-line Japanese summary, e.g. "動詞 Qal 完了 3人称 男性 単数". */
export function summarizeHebrewMorphology(m: HebrewMorphology): string {
  return [m.language === "arc" ? "アラム語" : null, m.pos, m.kind, m.stem, m.form, m.person, m.gender, m.number, m.state].filter(Boolean).join(" ");
}
