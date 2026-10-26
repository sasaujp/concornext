import { createAsync } from "@solidjs/router";
import { Info } from "lucide-solid";
import { For, Show, Suspense } from "solid-js";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { appInfoQuery } from "~/lib/queries";

/** Header button showing data sources, versions and AI configuration. */
export function DataInfo() {
  const info = createAsync(() => appInfoQuery());
  return (
    <Dialog>
      <DialogTrigger as={Button} variant="ghost" size="sm" aria-label="データとバージョン">
        <Info class="size-4" aria-hidden="true" />
        <span class="hidden sm:inline">データについて</span>
      </DialogTrigger>
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>データソースとバージョン</DialogTitle>
          <DialogDescription>出現箇所と形態素はすべて STEPBible の確定データから表示しています。</DialogDescription>
        </DialogHeader>
        <div class="space-y-3 text-sm leading-relaxed">
          <p>
            <strong>ギリシャ語本文・形態素</strong>: STEPBible TAGNT（Translators Amalgamated Greek NT, CC BY 4.0）。
            校訂版の列に NA28 を含む語だけを取り込み、TAGNT の語順・句読点で本文を構成しています。
            NA28 の印刷版とは句読点・語順が一致しない場合があり、完全な NA28 本文ではありません。
          </p>
          <p>
            <strong>語義・辞書</strong>: STEPBible TBESG（Abbott-Smith に基づく簡易辞書, CC BY 4.0）。
          </p>
          <p>
            <strong>英訳</strong>: Berean Standard Bible（bible.helloao.org Free Use Bible API）。
          </p>
          <Suspense fallback={<p class="text-muted-foreground">読み込み中…</p>}>
            <Show when={info()}>
              {i => (
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border p-3 text-xs">
                  <For each={i().dataVersions}>
                    {v => (
                      <>
                        <dt class="text-muted-foreground">{v.source}</dt>
                        <dd class="font-mono break-all">
                          {v.version.slice(0, 12)}（取込 {v.importedAt.slice(0, 10)}）
                        </dd>
                      </>
                    )}
                  </For>
                  <dt class="text-muted-foreground">AI モデル</dt>
                  <dd class="font-mono">{i().model}</dd>
                  <dt class="text-muted-foreground">プロンプト</dt>
                  <dd class="font-mono">{i().promptVersion}</dd>
                  <dt class="text-muted-foreground">API キー</dt>
                  <dd>{i().hasApiKey ? "設定済み" : "未設定"}</dd>
                </dl>
              )}
            </Show>
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}
