import { A, createAsync, useLocation } from "@solidjs/router";
import { Library } from "lucide-solid";
import { createEffect, createSignal, on, Show, Suspense } from "solid-js";
import { Concordance, ConcordanceSkeleton, type ConcordanceState, HeaderSkeleton, LemmaHeader } from "~/components/LemmaPanel";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { lemmaDetailQuery } from "~/lib/queries";
import { lemmaHref } from "~/lib/url";

/**
 * A lemma's concordance in a dialog, so it can be looked up without leaving the current page.
 * The book filter and page live in the dialog; following a verse link closes it.
 */
export function ConcordanceDialog(props: { strongsId: string | null; onClose: () => void }) {
  const location = useLocation();
  // Close when a link inside (a verse, the lexicon page) navigates away.
  createEffect(on(() => `${location.pathname}${location.search}`, () => props.onClose(), { defer: true }));

  return (
    <Dialog open={!!props.strongsId} onOpenChange={open => !open && props.onClose()}>
      {/* Only the inner body scrolls, so the close button stays put and there is a single scrollbar. */}
      <DialogContent class="block max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl overflow-hidden rounded-lg p-0">
        <Show when={props.strongsId} keyed>
          {s => <Body strongsId={s} />}
        </Show>
      </DialogContent>
    </Dialog>
  );
}

function Body(props: { strongsId: string }) {
  const location = useLocation();
  const detail = createAsync(() => lemmaDetailQuery(props.strongsId));
  const [book, setBook] = createSignal<string | null>(null);
  const [page, setPage] = createSignal(1);
  let scroller: HTMLDivElement | undefined;
  const state: ConcordanceState = {
    book,
    page,
    setBook: b => {
      setBook(b ?? null);
      setPage(1);
    },
    setPage: n => {
      setPage(n);
      scroller?.scrollTo({ top: 0 });
    },
    returnTo: () => `${location.pathname}${location.search}`,
  };

  return (
    <div ref={scroller} class="max-h-[92dvh] space-y-5 overflow-y-auto p-4 sm:p-6">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pr-8">
        <DialogTitle class="text-sm font-medium text-muted-foreground">コンコルダンス</DialogTitle>
        <Button as={A} href={lemmaHref(props.strongsId)} variant="link" size="sm" class="h-auto px-0">
          <Library class="size-4" aria-hidden="true" /> 辞書ページで開く
        </Button>
      </div>
      <Suspense fallback={<HeaderSkeleton />}>
        <Show when={detail()} fallback={<Alert>見出し語 {props.strongsId} は見つかりませんでした。</Alert>}>
          {d => <LemmaHeader lemma={d()} />}
        </Show>
      </Suspense>
      <Suspense fallback={<ConcordanceSkeleton />}>
        <Show when={detail()}>{d => <Concordance lemma={d()} state={state} />}</Show>
      </Suspense>
    </div>
  );
}
