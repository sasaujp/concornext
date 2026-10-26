/**
 * Deterministic decoder for the Robinson-style morphology codes used by STEPBible TAGNT
 * (see TEGMC – Translators Expansion of Greek Morphology Codes).
 * The output of this module is treated as ground truth; the LLM never overrides it.
 */

export interface Morphology {
  code: string;
  /** Part of speech, Japanese label. */
  pos: string;
  posKey: string;
  tense?: string;
  tenseKey?: "present" | "imperfect" | "future" | "aorist" | "perfect" | "pluperfect";
  /** "1st" / "2nd" form marker given by TAGNT (e.g. 2nd aorist). */
  tenseForm?: "first" | "second";
  voice?: string;
  mood?: string;
  moodKey?: "indicative" | "subjunctive" | "optative" | "imperative" | "infinitive" | "participle";
  person?: string;
  number?: string;
  case?: string;
  gender?: string;
  /** Additional notes (comparative, proper noun, Aramaic …). */
  extra: string[];
  isVerb: boolean;
  isAorist: boolean;
}

const POS: Record<string, string> = {
  V: "動詞",
  N: "名詞",
  A: "形容詞",
  T: "冠詞",
  P: "人称代名詞",
  R: "関係代名詞",
  D: "指示代名詞",
  C: "相互代名詞",
  F: "再帰代名詞",
  I: "疑問代名詞",
  K: "相関代名詞",
  Q: "相関・疑問代名詞",
  X: "不定代名詞",
  S: "所有代名詞（形容詞）",
  ADV: "副詞",
  CONJ: "接続詞",
  COND: "条件の接続詞",
  PREP: "前置詞",
  PRT: "不変化詞",
  INJ: "間投詞",
};

const TENSE: Record<string, [string, NonNullable<Morphology["tenseKey"]>]> = {
  P: ["現在", "present"],
  I: ["未完了過去", "imperfect"],
  F: ["未来", "future"],
  A: ["アオリスト", "aorist"],
  R: ["完了", "perfect"],
  L: ["過去完了", "pluperfect"],
};

const VOICE: Record<string, string> = {
  A: "能動態",
  M: "中動態",
  P: "受動態",
  E: "中動態または受動態",
  D: "中動態（デポーネント）",
  O: "受動態（デポーネント）",
  N: "中動態または受動態（デポーネント）",
  Q: "非人称能動態",
  X: "態なし",
};

const MOOD: Record<string, [string, NonNullable<Morphology["moodKey"]>]> = {
  I: ["直説法", "indicative"],
  S: ["接続法", "subjunctive"],
  O: ["希求法", "optative"],
  M: ["命令法", "imperative"],
  N: ["不定詞", "infinitive"],
  P: ["分詞", "participle"],
};

const CASE: Record<string, string> = { N: "主格", G: "属格", D: "与格", A: "対格", V: "呼格" };
const NUMBER: Record<string, string> = { S: "単数", P: "複数" };
const GENDER: Record<string, string> = { M: "男性", F: "女性", N: "中性" };
const PERSON: Record<string, string> = { "1": "1人称", "2": "2人称", "3": "3人称" };

const SUFFIX: Record<string, string> = {
  C: "比較級",
  S: "最上級",
  N: "否定",
  I: "疑問",
  T: "称号",
  P: "人名",
  PG: "人名（集合）",
  L: "地名",
  LG: "地名（集合）",
  LI: "地名（不変）",
  ATT: "アッティカ形",
  ARAM: "アラム語",
  HEB: "ヘブライ語",
  AP: "語尾脱落形",
};

function applyCNG(m: Morphology, cng: string | undefined) {
  if (!cng) return;
  const [c, n, g] = cng.split("");
  if (c && CASE[c]) m.case = CASE[c];
  if (n && NUMBER[n]) m.number = NUMBER[n];
  if (g && GENDER[g]) m.gender = GENDER[g];
}

function applySuffixes(m: Morphology, parts: string[]) {
  for (const p of parts) if (SUFFIX[p]) m.extra.push(SUFFIX[p]);
}

export function decodeMorphology(code: string): Morphology {
  const parts = code.trim().split("-");
  const head = parts[0];
  const m: Morphology = {
    code,
    pos: POS[head] ?? head,
    posKey: head,
    extra: [],
    isVerb: head === "V",
    isAorist: false,
  };

  if (head === "V") {
    const tvm = parts[1] ?? "";
    const mt = tvm.match(/^(2)?([PIFARL])([AMPEDONQX])([ISOMNP])$/);
    if (mt) {
      const [, second, t, v, mo] = mt;
      const [tenseJa, tenseKey] = TENSE[t];
      m.tenseKey = tenseKey;
      m.tenseForm = second ? "second" : "first";
      m.tense = second ? `第2${tenseJa}` : tenseJa;
      m.voice = VOICE[v];
      const [moodJa, moodKey] = MOOD[mo];
      m.mood = moodJa;
      m.moodKey = moodKey;
      m.isAorist = tenseKey === "aorist";
      const rest = parts.slice(2);
      if (moodKey === "participle") {
        applyCNG(m, rest[0]);
        applySuffixes(m, rest.slice(1));
      } else if (moodKey === "infinitive") {
        applySuffixes(m, rest);
      } else if (rest[0]) {
        const pn = rest[0].match(/^([123])([SP])$/);
        if (pn) {
          m.person = PERSON[pn[1]];
          m.number = NUMBER[pn[2]];
        }
        applySuffixes(m, rest.slice(1));
      }
    }
    return m;
  }

  // Personal pronoun: P-1GS (1st/2nd person) or P-NSM (3rd person, αὐτός)
  if (head === "P" || head === "F") {
    const x = parts[1] ?? "";
    const pm = x.match(/^([123])([NGDAV])([SP])([MFN])?$/);
    if (pm) {
      m.person = PERSON[pm[1]];
      m.case = CASE[pm[2]];
      m.number = NUMBER[pm[3]];
      if (pm[4]) m.gender = GENDER[pm[4]];
    } else {
      applyCNG(m, x);
    }
    applySuffixes(m, parts.slice(2));
    return m;
  }

  // Possessive: S-1SNSM = 1st person, singular possessor, then case/number/gender
  if (head === "S") {
    const sm = (parts[1] ?? "").match(/^([123])([SP])([NGDAV])([SP])([MFN])$/);
    if (sm) {
      m.person = `${PERSON[sm[1]]}${NUMBER[sm[2]]}の所有者`;
      m.case = CASE[sm[3]];
      m.number = NUMBER[sm[4]];
      m.gender = GENDER[sm[5]];
    }
    return m;
  }

  if (["N", "A", "T", "R", "D", "C", "I", "K", "Q", "X"].includes(head)) {
    const x = parts[1];
    if (x && /^[NGDAV][SP][MFN]?$/.test(x)) {
      applyCNG(m, x);
      applySuffixes(m, parts.slice(2));
    } else {
      if (x === "PRI" || x === "OI") m.extra.push("不変化（格変化なし）");
      applySuffixes(m, parts.slice(1));
    }
    return m;
  }

  applySuffixes(m, parts.slice(1));
  return m;
}

/** Compact Japanese summary, e.g. "動詞・第2アオリスト・中動態（デポーネント）・直説法・3人称・単数". */
export function summarizeMorphology(m: Morphology): string {
  return [m.pos, m.tense, m.voice, m.mood, m.person, m.case, m.gender, m.number, ...m.extra]
    .filter(Boolean)
    .join("・");
}
