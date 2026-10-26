import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div class="mx-auto max-w-md space-y-4 p-10 text-center">
      <HttpStatusCode code={404} />
      <h1 class="text-2xl font-semibold">ページが見つかりません</h1>
      <p class="text-sm text-muted-foreground">URL を確認するか、語彙一覧に戻ってください。</p>
      <Button as={A} href="/">
        語彙一覧へ
      </Button>
    </div>
  );
}
