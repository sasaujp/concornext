/**
 * Translates the English lemma glosses (TBESG) into short Japanese glosses with Claude Haiku and
 * stores them in data/glosses-ja.json (keyed by extended Strong's number). The JSON is committed,
 * so imports never need the API; `pnpm data:build` puts it into lemmas.gloss_ja.
 *
 *   pnpm data:translate-glosses            # translate what is missing (resumable)
 *   pnpm data:translate-glosses --redo G3056 G1096
 *   LIMIT=30 pnpm data:translate-glosses       # try a few first
 *
 * Reads the lemmas from the local D1 (run the import first) and the API key from
 * ANTHROPIC_API_KEY or .dev.vars.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const OUT = join(process.cwd(), "data", "glosses-ja.json");
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
const BATCH = 80;
const CONCURRENCY = 4;

interface Row {
  strongs_id: string;
  greek_lemma: string;
  alt_lemma: string | null;
  transliteration: string | null;
  gloss: string | null;
  lex_pos: string | null;
  def: string | null;
}

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const line = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8").split("\n").find(l => l.startsWith("ANTHROPIC_API_KEY=")) : undefined;
  if (!line) throw new Error("ANTHROPIC_API_KEY is not set (env or .dev.vars)");
  return line.slice("ANTHROPIC_API_KEY=".length).trim();
}

function loadLemmas(): Row[] {
  const sql =
    "SELECT l.strongs_id, l.greek_lemma, l.alt_lemma, l.transliteration, l.gloss, l.lex_pos, substr(d.definition_html, 1, 600) AS def " +
    "FROM lemmas l LEFT JOIN lemma_definitions d ON d.lemma_id = l.id ORDER BY l.id";
  const out = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "concornext", "--local", "--json", "--command", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
  return (JSON.parse(out) as { results: Row[] }[])[0].results;
}

/** First part of the lexicon entry as plain text, as context for disambiguation. */
function defExcerpt(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<ref='[^']*'>[^<]*<\/ref>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[in LXX[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

const SYSTEM = `あなたは新約聖書ギリシャ語の辞書を日本語化する編集者です。各見出し語の英語の簡易語義（gloss）を、学習者向けの短い日本語の語義に訳してください。

規則:
- 簡潔に（目安 2〜15 文字）。説明文ではなく辞書の見出し語義として書く。
- 品詞に合わせる: 動詞は「〜する」「〜である」などの終止形、形容詞は「良い」、名詞は名詞、前置詞・接続詞・不変化詞は「〜の中に」「そして」「〜ということ」のように働きが分かる形。
- 英語の構造を保つ: 「A: B」（B はその見出しで区別される特定の用法）は「A：B」、「A/B」は「A／B」とする。例: "lord: God" → "主：神"、"that/since: that" → "〜ということ／〜なので：〜ということ"。
- 固有名詞（人名・地名・民族名）は、日本語の聖書（新共同訳・聖書協会共同訳）で一般的なカタカナ表記にする。例: Aaron → アロン、John → ヨハネ、Jerusalem → エルサレム。
- 英語の語義が曖昧なときは、ギリシャ語の見出し語と辞書の抜粋から新約聖書での意味を判断する（例: λόγος の "word" → "ことば"）。
- 神学的な解釈を加えない。辞書の語義として中立に訳す。
- 入力のすべての strongsId について、1 つずつ訳を返す。`;

const Result = z.object({
  items: z.array(z.object({ strongsId: z.string(), ja: z.string().describe("日本語の語義") })),
});

async function translate(client: Anthropic, rows: Row[]): Promise<Record<string, string>> {
  const input = rows
    .map(r =>
      JSON.stringify({
        strongsId: r.strongs_id,
        greek: r.greek_lemma + (r.alt_lemma ? `（TAGNT: ${r.alt_lemma}）` : ""),
        translit: r.transliteration,
        pos: r.lex_pos,
        gloss: r.gloss,
        lexicon: defExcerpt(r.def),
      }),
    )
    .join("\n");
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: zodOutputFormat(Result) },
    system: SYSTEM,
    messages: [{ role: "user", content: `次の ${rows.length} 語の gloss を日本語にしてください（1 行 1 語の JSON）。\n\n${input}` }],
  });
  if (response.stop_reason !== "end_turn") throw new Error(`stop_reason=${response.stop_reason}`);
  const out: Record<string, string> = {};
  const wanted = new Set(rows.map(r => r.strongs_id));
  for (const item of response.parsed_output?.items ?? []) {
    const ja = item.ja.trim();
    if (wanted.has(item.strongsId) && ja) out[item.strongsId] = ja;
  }
  return out;
}

async function main() {
  const redoIdx = process.argv.indexOf("--redo");
  const redo = new Set(redoIdx >= 0 ? process.argv.slice(redoIdx + 1) : []);
  const done: Record<string, string> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  for (const id of redo) delete done[id];

  const only = process.env.ONLY?.split(",");
  const rows = loadLemmas()
    .filter(r => r.gloss && !done[r.strongs_id])
    .filter(r => !only || only.includes(r.strongs_id))
    .slice(0, Number(process.env.LIMIT ?? Infinity));
  console.log(`${rows.length} glosses to translate (${Object.keys(done).length} already done) with ${MODEL}`);
  if (!rows.length) return;

  const client = new Anthropic({ apiKey: apiKey(), maxRetries: 3, timeout: 180_000 });
  const batches: Row[][] = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));

  const save = () => {
    const sorted = Object.fromEntries(Object.entries(done).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(OUT, JSON.stringify(sorted, null, 1) + "\n");
  };

  let next = 0;
  let failed = 0;
  async function worker() {
    while (next < batches.length) {
      const n = next++;
      const batch = batches[n];
      // Retry once with the items the model skipped.
      let pending = batch;
      for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
        try {
          Object.assign(done, await translate(client, pending));
        } catch (e) {
          console.error(`  batch ${n + 1}: ${e instanceof Error ? e.message : e}`);
        }
        pending = pending.filter(r => !done[r.strongs_id]);
      }
      failed += pending.length;
      save();
      console.log(`  batch ${n + 1}/${batches.length} done (${Object.keys(done).length} total${pending.length ? `, ${pending.length} missing` : ""})`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Finished. ${Object.keys(done).length} glosses in data/glosses-ja.json${failed ? `; ${failed} still missing — run again` : ""}.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
