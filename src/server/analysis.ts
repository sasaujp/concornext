/**
 * Claude Haiku grammar analysis of one verse.
 * STEPBible morphology is passed in as fixed data; the model only supplies syntax and explanation.
 * Output is schema-validated and reconciled against the deterministic morphology before caching.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { aiAnalyses, dataVersions, lemmas } from "~/db/schema";
import { bookByCode, formatRef } from "~/lib/books";
import { decodeMorphology, summarizeMorphology } from "~/lib/morph";
import { AnalysisSchema, reconcileAnalysis, type Analysis } from "./analysis-schema";
import { getBsbVerses, TRANSLATION } from "./bsb";
import type { Db } from "./db";
import { getVerseTokens, type VerseTokens } from "./lexicon";

export const PROMPT_VERSION = "2026-10-27.2";
const DEFAULT_MODEL = "claude-haiku-5-5";

export type AnalysisResponse =
  | { status: "ok"; analysis: Analysis; model: string; createdAt: string; cached: boolean; sourceVersion: string; promptVersion: string }
  | { status: "no_api_key" }
  | { status: "error"; message: string };

export interface AnalysisRequest {
  book: string;
  chapter: number;
  verse: number;
  strongsId: string;
  position: number;
  regenerate?: boolean;
}

const SYSTEM_PROMPT = `あなたは新約聖書ギリシャ語（コイネー）の文法を教える教師です。学習者が原文の実例を通して文法を理解できるよう、日本語で正確かつ教育的に解説してください。

厳守事項:
- 各語の見出し語・品詞・時制・態・法・人称・数・格・性は、入力の「確定データ（STEPBible TAGNT）」が正です。これと矛盾する語形分析をしてはいけません。迷う場合も確定データに従ってください。
- アオリストとして扱ってよいのは、確定データで時制が「アオリスト」「第2アオリスト」と記された語だけです。それ以外の語をアオリストとして説明しないでください。
- アオリストを一律に「過去形」「一度限りの動作」と説明しないでください。アオリストは動作を全体として（完結相・perfective aspect）提示する相であり、時間的な過去性は主に直説法で加音とともに表されること、分詞・不定詞・接続法・命令法では時間よりも相が中心であることを、文脈に即して説明してください。
- 文法的事実（形態・統語から言えること）と、解釈・釈義上の推論を区別してください。特定の教派や神学的立場を前提にせず、本文から支持できる説明を優先してください。
- ギリシャ語は入力本文の綴りどおりに引用してください。本文は TAGNT から構成したもので、NA28 の印刷版と句読点・語順が完全に一致するとは限りません。
- 語形の成り立ちは「加音・重複」「時制語幹」「語尾」を分けて示してください（例: ἐ-γέν-ετο = 加音 ἐ- ＋ 第2アオリスト語幹 γεν- ＋ 語尾 -ετο）。語幹に加音を含めないでください。
- 該当しない文法項目は書かないでください（名詞に時制を書くなど）。`;

function morphLine(t: VerseTokens["tokens"][number]): string {
  return t.parts
    .map(p => {
      const m = decodeMorphology(p.morphology);
      return `${p.lemma}（${p.strongsId}, ${p.gloss ?? ""}）${p.morphology} = ${summarizeMorphology(m)}`;
    })
    .join(" ＋ ");
}

function buildPrompt(verse: VerseTokens, target: VerseTokens["tokens"][number], strongsId: string, english: Record<string, string | null>, context: { prev: VerseTokens | null; next: VerseTokens | null }) {
  const ref = formatRef(verse.book, verse.chapter, verse.verse);
  const book = bookByCode(verse.book)!;
  const greek = (v: VerseTokens) => v.tokens.map(t => t.surface).join(" ");
  const aorists = verse.tokens.filter(t => t.parts.some(p => decodeMorphology(p.morphology).isAorist));
  const lines = [
    `# 対象箇所: ${book.en} ${verse.chapter}:${verse.verse}（${ref}）`,
    "",
    "## ギリシャ語本文（TAGNT の NA28 本文語から構成）",
    greek(verse),
    "",
    `## BSB 英訳`,
    english[ref] ?? "（取得できませんでした）",
    "",
    "## 確定データ: 各語の形態素（#位置: 語形 → 見出し語 / 形態素）",
    ...verse.tokens.map(t => `#${t.position}: ${t.surface} → ${morphLine(t)}`),
    "",
    `## 学習対象の語`,
    `#${target.position}: ${target.surface}（見出し語 ${target.parts.find(p => p.strongsId === strongsId)?.lemma ?? ""}, ${strongsId}）`,
    "",
    "## この節のアオリスト形（確定データより）",
    aorists.length ? aorists.map(t => `#${t.position}: ${t.surface}（${t.parts.map(p => p.morphology).join(" + ")}）`).join("\n") : "なし",
  ];
  if (context.prev || context.next) {
    lines.push("", "## 前後の節（文脈参照用。分析対象ではありません）");
    if (context.prev) lines.push(`前節 ${context.prev.chapter}:${context.prev.verse}: ${greek(context.prev)}`, `  BSB: ${english[formatRef(context.prev.book, context.prev.chapter, context.prev.verse)] ?? ""}`);
    if (context.next) lines.push(`次節 ${context.next.chapter}:${context.next.verse}: ${greek(context.next)}`, `  BSB: ${english[formatRef(context.next.book, context.next.chapter, context.next.verse)] ?? ""}`);
  }
  lines.push(
    "",
    "## 依頼",
    "上の節について、A. 構文解析、B. 各語の統語的役割と対象語の語形解析、C. アオリストの解説（無ければ無いことを明示）、D. 逐語訳・自然な日本語訳・翻訳上の判断、E. 文法的事実と解釈上の推論の区別、を指定の JSON 形式で返してください。",
  );
  return lines.join("\n");
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function sourceVersion(db: Db): Promise<string> {
  const [row] = await db.select({ version: dataVersions.version }).from(dataVersions).where(eq(dataVersions.source, "STEPBible-Data"));
  return `stepbible:${row?.version.slice(0, 12) ?? "unknown"}+${TRANSLATION}`;
}

export function analysisModel(): string {
  return env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export async function getCachedAnalysis(db: Db, req: AnalysisRequest): Promise<AnalysisResponse | null> {
  const model = analysisModel();
  const src = await sourceVersion(db);
  const cacheKey = await sha256([formatRef(req.book, req.chapter, req.verse), req.strongsId, req.position, src, PROMPT_VERSION, model].join("|"));
  const [row] = await db.select().from(aiAnalyses).where(eq(aiAnalyses.cacheKey, cacheKey));
  if (!row) return null;
  return {
    status: "ok",
    analysis: AnalysisSchema.parse(JSON.parse(row.analysisJson)),
    model: row.model,
    createdAt: row.createdAt,
    cached: true,
    sourceVersion: row.sourceVersion,
    promptVersion: row.promptVersion,
  };
}

export async function runAnalysis(db: Db, req: AnalysisRequest): Promise<AnalysisResponse> {
  if (!req.regenerate) {
    const cached = await getCachedAnalysis(db, req);
    if (cached) return cached;
  }
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return { status: "no_api_key" };

  const verse = await getVerseTokens(db, req.book, req.chapter, req.verse);
  if (!verse) return { status: "error", message: "指定された節が見つかりません。" };
  const target = verse.tokens.find(t => t.position === req.position && t.parts.some(p => p.strongsId === req.strongsId));
  if (!target) return { status: "error", message: "指定された語がこの節に見つかりません。" };

  const [prev, next] = await Promise.all([
    req.verse > 1 ? getVerseTokens(db, req.book, req.chapter, req.verse - 1) : Promise.resolve(null),
    getVerseTokens(db, req.book, req.chapter, req.verse + 1),
  ]);
  const english = (
    await getBsbVerses(db, [verse, prev, next].filter((v): v is VerseTokens => !!v))
  ).verses;

  const model = analysisModel();
  const client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  let analysis: Analysis;
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(AnalysisSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(verse, target, req.strongsId, english, { prev, next }) }],
    });
    if (response.stop_reason === "refusal") return { status: "error", message: "モデルが応答を拒否しました。" };
    if (response.stop_reason === "max_tokens") return { status: "error", message: "応答が長すぎて途中で切れました。再生成してください。" };
    // Server-side validation (parse() already validates; re-check to be explicit).
    const parsed = AnalysisSchema.safeParse(response.parsed_output);
    if (!parsed.success) return { status: "error", message: "解析結果の形式が不正でした。再生成してください。" };
    analysis = reconcileAnalysis(parsed.data, verse, target.position);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { status: "error", message: "Anthropic APIキーが無効です。設定を確認してください。" };
    if (e instanceof Anthropic.NotFoundError) return { status: "error", message: `モデル ${model} が見つかりません。ANTHROPIC_MODEL を確認してください。` };
    if (e instanceof Anthropic.RateLimitError) return { status: "error", message: "APIのレート制限に達しました。しばらく待って再試行してください。" };
    if (e instanceof Anthropic.APIError) return { status: "error", message: `Anthropic API エラー (${e.status}): ${e.message}` };
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }

  const src = await sourceVersion(db);
  const ref = formatRef(req.book, req.chapter, req.verse);
  const cacheKey = await sha256([ref, req.strongsId, req.position, src, PROMPT_VERSION, model].join("|"));
  const [lemma] = await db.select({ id: lemmas.id }).from(lemmas).where(eq(lemmas.strongsId, req.strongsId));
  const createdAt = new Date().toISOString();
  const values = {
    cacheKey,
    passageReference: ref,
    selectedLemmaId: lemma?.id ?? null,
    selectedTokenPosition: req.position,
    model,
    promptVersion: PROMPT_VERSION,
    sourceVersion: src,
    analysisJson: JSON.stringify(analysis),
    createdAt,
  };
  await db.insert(aiAnalyses).values(values).onConflictDoUpdate({ target: aiAnalyses.cacheKey, set: values });
  return { status: "ok", analysis, model, createdAt, cached: false, sourceVersion: src, promptVersion: PROMPT_VERSION };
}
