# ConcorNext

古代ギリシャ語新約聖書を、原文と実例から学ぶための個人用 Web アプリです。

1. 見出し語（lemma）を一覧から選ぶ（既定はアルファベット順。ギリシャ文字の頭文字ボタンで絞り込み、転写（見出し語・活用形とも。例: logos, egeneto）・英語の語義・Strong's 番号で検索。転写は長音記号と h の有無を区別しない。ギリシャ語での入力も可）
   - 各見出し語に 1 行のメモ（例: 釈義ノートの記載場所「ノート1巻 p.4-7」）を付けられる。メモは一覧に表示され、「メモあり」で絞り込み・メモの文字列で検索ができる
2. その語の全出現箇所（コンコルダンス）を、ギリシャ語本文・BSB 英訳・形態素つきで聖書順に読む
3. 任意の節から Claude Haiku による日本語の文法解析（構文・語形・アオリスト・翻訳）を開く

出現箇所と形態素は STEPBible の確定データから表示します。LLM には推測させません。

利用にはログインが必要です（ユーザー名＋パスキー、招待制）。メモと書名の選択はユーザーごとに保存されます。

## 技術構成

| 項目 | 採用 |
|---|---|
| フレームワーク | SolidStart 2.1（Vite 8） |
| UI | SolidJS + Solid UI（Kobalte）+ lucide-solid |
| CSS | Tailwind CSS 4（Solid UI の v3 設定を `@config` で読み込み） |
| ホスティング | Cloudflare Workers（`@cloudflare/vite-plugin`、Pages は不使用） |
| DB | Cloudflare D1 + Drizzle ORM / Drizzle Kit |
| LLM | Anthropic Claude Haiku（既定 `claude-haiku-5-5`）、`@anthropic-ai/sdk` の構造化出力（zod） |
| テスト | Vitest |
| パッケージ管理 | pnpm |

SSR、サーバー関数、D1 アクセス、Anthropic API 呼び出しは、すべて Workers ランタイム（workerd）の中で実行されます。開発時も同じです。

## データ

| データ | 用途 | 取得元 |
|---|---|---|
| STEPBible **TAGNT**（Mat–Jhn, Act–Rev） | 語形・lemma・Strong's・形態素・出現位置・校訂版 | github.com/STEPBible/STEPBible-Data |
| STEPBible **TBESG** | 見出し語・転写・英語語義・辞書本文 | 同上 |
| **BSB**（Berean Standard Bible） | 英訳（章単位で取得して D1 にキャッシュ） | bible.helloao.org Free Use Bible API |

いま取り込んであるのは STEPBible-Data `be4191f0082a`（2026-10-24）です。内訳は NA28 の語 137,919、出現行 138,173、見出し語 5,554 です。バージョンは画面右上の「データについて」と、D1 の `data_versions` テーブルで確認できます。

### NA28 の扱い

- TAGNT は複数の校訂版を統合したデータです。ConcorNext は **editions 列に `NA28` を含む語だけ**を取り込みます。TR/Byz のみの語など 4,177 語は除外しています。
- ギリシャ語本文は、取り込んだ語を TAGNT の語順と句読点で並べて構成しています。NA28 で位置が異なる語（`NA28»2` など）には、本文中に ↔ を付けています。**NA28 の印刷版と完全に一致する本文ではありません**。画面にもその旨を表示しています。
- κἀγώ などの融合形（crasis）は、構成要素ごとに出現行を作ります（同じ `token_position` を `part` で区別）。そのため κἀγώ は καί と ἐγώ の両方のコンコルダンスに現れます。
- 見出し語は TBESG の見出しを使い、Strong's 番号（拡張 Strong's）ごとに分けて扱います。同形異義語や別番号を統合することはしません。TAGNT が別の辞書形を付けている約 50 語（例: G3165 μέ → ἐγώ）は `alt_lemma` として保存し、一覧と見出しに併記したうえで検索対象にも含めます。

## セットアップ

前提: Node.js 22 以上、pnpm 10。

```sh
pnpm install

# 1) STEPBible データを取得する（data/raw/ に保存し、コミット SHA を VERSION.json に記録）
pnpm data:download            # 特定のコミットを使う場合: pnpm data:download <sha>

# 2) D1 用の SQL を生成する（data/sql/。最初のファイルが既存データを削除するので、何度でも再実行できる）
pnpm data:build

# 3) ローカル D1 にスキーマとデータを投入する
pnpm db:migrate:local
pnpm data:import:local

# 4) AI 解析を使う場合は API キーを設定する
cp .dev.vars.example .dev.vars   # ANTHROPIC_API_KEY を記入

# 5) 起動
pnpm dev                          # http://localhost:5173

# 6) 最初の管理者を招待して登録（表示された URL をブラウザで開き、ユーザー名とパスキーを作成）
pnpm admin:invite --local --url http://localhost:5173 --admin
```

API キーがなくても、語彙一覧・コンコルダンス・形態素は使えます。AI 解析の欄には、キーの設定方法が表示されます。

### その他のコマンド

```sh
pnpm test        # Vitest（形態素デコード、正規化、TAGNT パーサ、AI 結果の照合、ローカル D1 の実データ検証）
pnpm typecheck   # tsc --noEmit
pnpm preview     # 本番ビルドを wrangler dev（workerd）で起動する
pnpm cf-typegen  # wrangler.jsonc からバインディングの型（src/worker-configuration.d.ts）を再生成する
pnpm db:generate # スキーマ変更後にマイグレーションを生成する（drizzle/）
```

`tests/data.test.ts` はローカル D1 に実データが入っているときだけ実行されます。入っていなければスキップします。

## Cloudflare Workers へのデプロイ

```sh
pnpm exec wrangler login

# D1 データベースを作成し、表示された database_id を wrangler.jsonc の d1_databases[0].database_id に書く
pnpm exec wrangler d1 create concornext

pnpm db:migrate:remote
pnpm data:import:remote           # data/sql/*.sql を順に投入する（約 22 MB）

pnpm exec wrangler secret put ANTHROPIC_API_KEY

pnpm run deploy                   # vite build && wrangler deploy（`pnpm deploy` は pnpm の組み込みコマンドなので run が必要）
```

デプロイ後、最初の管理者の招待リンクを発行して、本番 URL で登録します。

```sh
pnpm admin:invite --remote --url https://concornext.<account>.workers.dev --admin
```

モデルを変える場合は `wrangler.jsonc` の `vars.ANTHROPIC_MODEL` を編集します（Wrangler の環境変数で上書きしても構いません）。

データを更新するときは `pnpm data:download && pnpm data:build && pnpm data:import:remote` を実行します。lemma の ID は Strong's 番号から決まる値なので、取り込み直しても変わりません。

## 構成

```
src/
  routes/index.tsx           語彙一覧 + 見出し語詳細 + コンコルダンス（状態は URL に保持: q, sort, l, memo, page, s, book, cp）
  routes/verse/[ref].tsx     節ページ: 本文・形態素（確定データ）・アオリスト一覧・AI 解析（?s=&w=&from=）
  components/                LemmaList, LemmaPanel, GreekVerse, MorphBadges, AnalysisView, DataInfo, ui/（Solid UI）
  lib/morph.ts               TAGNT（Robinson 形式）形態素コードのデコーダ。isAorist の判定はここだけで行う
  lib/greek.ts               アクセント無視の正規化、Strong's 番号の解析
  lib/books.ts               書名コード対応表（TAGNT / USFM（helloao）/ 日本語 / BibleHub）
  server/lexicon.ts          D1 検索（語彙・コンコルダンス・節）
  server/bsb.ts              BSB の章単位取得と D1 キャッシュ（障害時もギリシャ語は表示する）
  server/analysis*.ts        Claude 解析: プロンプト、zod スキーマ、確定データとの照合、キャッシュ
  server/api.ts              "use server" のサーバー関数
  db/schema.ts               Drizzle スキーマ
scripts/                     STEPBible のダウンロード / SQL 生成 / D1 投入
drizzle/                     マイグレーション
tests/                       Vitest
```

### ログイン（パスキー）

- **登録は招待制**です。最初の管理者は `pnpm admin:invite --admin` で発行したリンクから登録します。その後は、管理者がアカウント画面で招待リンク（QR コード付き、7 日間有効、1 回限り）を作成します。
- **ログイン**はユーザー名＋パスキー（WebAuthn。Touch ID・Face ID・Windows Hello・パスワードマネージャーなど）で行います。パスワードはありません。
- **端末の追加**：ログイン済みの端末のアカウント画面で QR コードを表示し、新しい端末で読み取ってパスキーを追加します（10 分間有効、1 回限り）。
- **セッション**は HttpOnly cookie（30 日）です。D1 にはトークンの SHA-256 だけを保存します。招待・端末追加のトークンも同様にハッシュで保存します。
- **アクセス制限**：`src/middleware.ts` が全リクエストでセッションを確認します。未ログインのページ遷移は `/login` へリダイレクトし、サーバー関数の呼び出しは 401 で拒否します。認証用の JSON API は `src/routes/api/auth/[...path].ts` にあります。
- **既存データの引き継ぎ**：アカウント導入前のメモ（`user_id = ''`）は、最初に登録した管理者のものになります。
- **テスト**：`tests/e2e/auth.test.ts` は、ソフトウェア認証器（P-256 鍵による本物の WebAuthn 署名）で、招待→登録→ログアウト→ログイン→端末追加→不正なパスキーの拒否→別サイトからのリクエストの拒否を、起動中のアプリに対して確認します（`E2E_BASE_URL=http://localhost:5199 pnpm exec vitest run tests/e2e`）。

### 学習する書（ヘッダー）

ヘッダーで書を選ぶと、左ペインはその書に出てくる語だけになります。出現回数と頻度順もその書の中での値になります。右ペインのコンコルダンスも、その書が初期選択になります（URL で `book=` を指定した場合は、そちらが優先されます。`book=all` は「すべての書」）。選択は D1 の `user_settings`（キー `scope_book`）にユーザーごとに保存されます。サーバー側で描画する時点で反映されます。

### メモ

`lemma_notes` テーブルにユーザー ID と Strong's 番号をキーとして保存します（lemma の ID ではないので、データを取り込み直しても消えません。`data:import` もこのテーブルには触れません）。プロトタイプにあった 6 語の記載場所は、マイグレーション `0003_seed_sample_notes.sql` で初期値として 1 回だけ入ります（`INSERT OR IGNORE` のため、あとで編集した内容を上書きしません）。

### AI 解析の設計

- プロンプトには、節の全語について確定データを渡します（語形、lemma、Strong's、形態素コードとその日本語展開）。あわせて対象語の位置、その節のアオリスト一覧、BSB 英訳、前後の節も渡します。
- 結果は `output_config.format`（zod スキーマ）で構造化 JSON として受け取ります。サーバー側ではスキーマで再検証し、`reconcileAnalysis` で確定データと照合します。形態素上アオリストでない語へのアオリスト解説や、存在しない位置番号への言及は破棄します。
- 結果は `ai_analyses` に保存します。キャッシュキーは「箇所・選択語・語の位置・本文データのバージョン（STEPBible の SHA と BSB）・プロンプトのバージョン・モデル ID」の SHA-256 です。「再生成」で明示的に作り直せます。

## 既知の制約・今後の課題

- 本文の語順は TAGNT の基準順のままで、NA28 での語順の違いは ↔ で示すだけです。並べ替えはしていません。
- 版の違いによる節番号のずれ（例: `Act.19.41(19.40)`）は NRSV 準拠の主番号で扱っています。BSB とは概ね一致しますが、完全ではありません。
- BSB は 1 リクエストあたり最大 12 章分まで取得します（Workers のサブリクエスト上限への配慮）。残りは次に表示したときに取得します。
- 語義は英語（TBESG）のみで、日本語の語義はありません。

## ライセンス

ソースコードは [MIT License](./LICENSE) です。

データは本リポジトリに含みません（`pnpm data:download` で各配布元から取得します）。

- STEPBible TAGNT / TBESG: © STEPBible.org / Tyndale House Cambridge, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。配布元: https://github.com/STEPBible/STEPBible-Data
- Berean Standard Bible: パブリックドメイン（bible.helloao.org の Free Use Bible API 経由）
