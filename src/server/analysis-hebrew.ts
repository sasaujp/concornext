/**
 * Prompt for the Claude analysis of an Old Testament verse (Hebrew / Aramaic, STEPBible TAHOT).
 * Same contract as the Greek one (src/server/analysis.ts): the STEPBible morphology, word segments and
 * Ketiv are fixed data; the model supplies syntax and explanation in the HebrewAnalysisSchema shape.
 */
import { bookByCode, formatRef } from "~/lib/books";
import { decodeHebrewMorphology, summarizeHebrewMorphology } from "~/lib/morph-hebrew";
import type { VerseTokens } from "./lexicon";

export const HEBREW_PROMPT_VERSION = "2026-11-11.1";

export const HEBREW_SYSTEM_PROMPT = `あなたは旧約聖書ヘブライ語（および聖書アラム語）の文法を教える教師です。学習者が原文の実例を通して文法を理解できるよう、日本語で正確かつ教育的に解説してください。

厳守事項:
- 各語の見出し語・品詞・語幹（Qal・Piel・Hiphil など）・活用形・人称・性・数・状態（絶対形・連語形）と、語の分解（接頭辞・本体・接尾辞）は、入力の「確定データ（STEPBible TAHOT）」が正です。これと矛盾する語形分析をしてはいけません。迷う場合も確定データに従ってください。
- 動詞として扱ってよいのは、確定データで品詞が「動詞」と記された語だけです。
- 活用形を単純に時制として説明しないでください。完了（qatal）は事態を完結したものとして示すことが多く、未完了（yiqtol）は未完結・継続・反復・未来・願望など幅があります。ワイイクトル（wayyiqtol）は主に物語の出来事を順に進める形で、ウェカータル（weqatal）は先行する未完了・命令などの流れを引き継ぐことが多い形です。どの働きと読めるかを文脈に即して説明してください。
- 語幹の意味を機械的に当てはめないでください（Piel は常に「強意」、Hiphil は常に「使役」とは限りません）。この語でこの文脈においてどう働いているかを説明してください。
- 接頭辞（ו・ה・ב・ל・כ・מ など）と代名詞接尾辞は、確定データの分解に沿って説明してください。
- ケレ／ケティブが入力にある語は、本文がケレ（欄外の読み）であることを踏まえ、必要に応じてケティブ（書かれた綴り）との違いに触れてください。
- アラム語の節（ダニエル書・エズラ記の一部）では、語幹名（Peal・Pael・Haphel など）もアラム語のものを使ってください。
- 文法的事実（形態・統語から言えること）と、解釈・釈義上の推論を区別してください。特定の教派や神学的立場を前提にせず、本文から支持できる説明を優先してください。
- ヘブライ語は入力本文の綴りどおり（母音記号を含めて）に引用してください。章節はヘブライ語聖書（MT）の番号で、英語訳と番号が異なることがあります。
- 該当しない文法項目は書かないでください（名詞に語幹を書くなど）。

文体:
- 説明文は「です・ます」調で、学習者に語りかけるように、やわらかく説明的に書いてください。体言止めや「〜である」「〜を示す」で終わる硬い文は避けてください。
- 1 文を短めにし、「なぜそう読めるのか」をひとこと添えてください（例:「וַיֹּאמֶר はワイイクトルなので、前の出来事に続く次の出来事として語られています」）。
- 専門用語（連語形、ワイイクトル、名詞文など）を初めて使うときは、短い言い換えを括弧で添えてください。
- 例外: 各語の「役割」（wordRoles.role）と節の種類（clauses.kind）は短い名詞句のままで構いません。逐語訳・自然な日本語訳の訳文そのものは、です・ます調にする必要はありません。`;

type Tok = VerseTokens["tokens"][number];

/** Hebrew words joined by maqqef are written without a space. */
export function hebrewText(v: VerseTokens): string {
  return v.tokens.map((t, i) => t.surface + (i < v.tokens.length - 1 && !t.surface.endsWith("־") ? " " : "")).join("");
}

const morph = (code: string) => `${code} = ${summarizeHebrewMorphology(decodeHebrewMorphology(code))}`;

/** One word as fixed data: its segments (prefixes/suffixes with their grammar), lemma(s), morphology, Ketiv. */
function wordLine(t: Tok): string {
  const lemmas = t.parts.map(p => `${p.lemma}（${p.strongsId}, ${[p.glossJa, p.gloss].filter(Boolean).join(" / ")}）${morph(p.morphology)}`).join(" ＋ ");
  const segs = t.segments
    ?.filter(s => s.k === "affix")
    .map(s => `${s.h}（${s.s}${s.m ? `, ${morph(s.m)}` : ""}）`)
    .join("、");
  const built = t.segments ? `［分解: ${t.segments.filter(s => s.k !== "punctuation" && s.k !== "separator").map(s => s.h).join(" + ")}］` : "";
  const ketiv = t.ketiv ? `［ケレ。ケティブ: ${t.ketiv}${t.ketivGloss ? `「${t.ketivGloss}」` : ""}］` : "";
  return `#${t.position}: ${t.surface} ${built}→ ${lemmas}${segs ? `；接辞: ${segs}` : ""}${ketiv}`;
}

export function buildHebrewPrompt(
  verse: VerseTokens,
  target: Tok,
  strongsId: string,
  english: Record<string, string | null>,
  context: { prev: VerseTokens | null; next: VerseTokens | null },
): string {
  const ref = formatRef(verse.book, verse.chapter, verse.verse);
  const book = bookByCode(verse.book)!;
  const aramaic = verse.tokens.some(t => t.parts.some(p => p.morphology.startsWith("A")));
  const verbs = verse.tokens.filter(t => t.parts.some(p => /^[HA]V/.test(p.morphology)));
  const lines = [
    `# 対象箇所: ${book.en} ${verse.chapter}:${verse.verse}（${ref}、MT の章節）${aramaic ? "（アラム語の節）" : ""}`,
    "",
    "## 原文（STEPBible TAHOT。レニングラード写本、ケレを本文とする）",
    hebrewText(verse),
    "",
    "## BSB 英訳（英語訳の章節で対応づけたもの）",
    english[ref] ?? "（取得できませんでした）",
    "",
    "## 確定データ: 各語の形態素（#位置: 語形 ［分解］→ 見出し語 / 形態素 ；接辞）",
    ...verse.tokens.map(wordLine),
    "",
    "## 学習対象の語",
    `#${target.position}: ${target.surface}（見出し語 ${target.parts.find(p => p.strongsId === strongsId)?.lemma ?? ""}, ${strongsId}）`,
    "",
    "## この節の動詞（確定データより）",
    verbs.length ? verbs.map(t => `#${t.position}: ${t.surface}（${t.parts.map(p => morph(p.morphology)).join(" + ")}）`).join("\n") : "なし",
  ];
  if (context.prev || context.next) {
    lines.push("", "## 前後の節（文脈参照用。分析対象ではありません）");
    for (const [label, v] of [["前節", context.prev], ["次節", context.next]] as const) {
      if (v) lines.push(`${label} ${v.chapter}:${v.verse}: ${hebrewText(v)}`, `  BSB: ${english[formatRef(v.book, v.chapter, v.verse)] ?? ""}`);
    }
  }
  lines.push(
    "",
    "## 依頼",
    "上の節について、A. 構文解析、B. 各語の統語的役割と対象語の語形解析、C. 動詞の語幹と活用形の解説（動詞が無ければ無いことを明示）、D. 逐語訳・自然な日本語訳・翻訳上の判断、E. 文法的事実と解釈上の推論の区別、を指定の JSON 形式で返してください。",
  );
  return lines.join("\n");
}
