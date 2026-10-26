/**
 * Resolves the session cookie on every request and keeps the app behind sign-in.
 * Public: the sign-in / invite / device-link pages and their JSON endpoints.
 */
import { createMiddleware } from "@solidjs/start/middleware";
import { getSessionUser } from "~/server/auth";
import { getDb } from "~/server/db";

const PUBLIC_PREFIXES = ["/login", "/invite/", "/link/", "/api/auth/", "/_build/", "/favicon.ico"];
/** Server functions callable without a session (their ids end with "-<exportName>"). */
const PUBLIC_SERVER_FUNCTIONS = ["fetchMe"];

export default createMiddleware({
  onRequest: async event => {
    const url = new URL(event.request.url);
    event.locals.user = await getSessionUser(getDb(), event.request);
    if (event.locals.user) return;
    if (PUBLIC_PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p))) return;

    if (url.pathname.startsWith("/_server")) {
      const id = event.request.headers.get("X-Server-Id")?.split("#")[0] ?? url.searchParams.get("id") ?? "";
      if (PUBLIC_SERVER_FUNCTIONS.some(name => id.endsWith(`-${name}`))) return;
      return new Response("ログインが必要です。", { status: 401 });
    }
    const next = encodeURIComponent(url.pathname + url.search);
    return new Response(null, { status: 302, headers: { Location: `/login?next=${next}` } });
  },
});
