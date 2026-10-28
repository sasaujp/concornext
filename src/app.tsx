import { A, createAsync, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { ErrorBoundary, onMount, Show, Suspense } from "solid-js";
import { BookOpenText, ScrollText, Star, UserRound } from "lucide-solid";
import { BookScopeSelect } from "~/components/BookScopeSelect";
import { DataInfo } from "~/components/DataInfo";
import { Button } from "~/components/ui/button";
import { AppError } from "~/components/AppError";
import { meQuery } from "~/lib/queries";
import { installGlobalErrorReporting } from "~/lib/report-error";
import "./app.css";

export default function App() {
  onMount(installGlobalErrorReporting);
  return (
    <Router
      root={props => (
        <>
          <div class="flex min-h-screen flex-col">
            <header class="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div class="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
                <A href="/" class="flex items-center gap-2 font-semibold tracking-tight" aria-label="ConcorNext（トップ）">
                  <BookOpenText class="size-5" aria-hidden="true" />
                  <span class="hidden sm:inline">ConcorNext</span>
                </A>
                <span class="hidden text-sm text-muted-foreground lg:inline">新約聖書ギリシャ語 コンコルダンスと文法学習</span>
                <HeaderControls />
              </div>
            </header>
            <main class="flex-1">
              <ErrorBoundary fallback={(error, reset) => <AppError error={error} reset={reset} />}>
                <Suspense>{props.children}</Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}

/** Book scope, data info and account link — only for signed-in users. */
function HeaderControls() {
  const me = createAsync(() => meQuery());
  return (
    <div class="ml-auto flex items-center gap-1">
      <Suspense>
        <Show when={me()}>
          {user => (
            <>
              <Button as={A} href="/passage" variant="ghost" size="sm" aria-label="本文を読む">
                <ScrollText class="size-4" aria-hidden="true" />
                <span class="hidden md:inline">本文</span>
              </Button>
              <Button as={A} href="/favorites" variant="ghost" size="sm" aria-label="お気に入りの節">
                <Star class="size-4" aria-hidden="true" />
                <span class="hidden md:inline">お気に入り</span>
              </Button>
              <BookScopeSelect />
              <DataInfo />
              <Button as={A} href="/account" variant="ghost" size="sm" aria-label={`アカウント（${user().username}）`}>
                <UserRound class="size-4" aria-hidden="true" />
                <span class="hidden md:inline">{user().username}</span>
              </Button>
            </>
          )}
        </Show>
      </Suspense>
    </div>
  );
}
