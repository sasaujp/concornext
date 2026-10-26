/**
 * Applies the SQL files produced by `pnpm data:build` to D1 via Wrangler.
 *
 *   pnpm data:import:local    # local (Miniflare) D1 used by `pnpm dev`
 *   pnpm data:import:remote   # the deployed D1 database
 */
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const dir = join(process.cwd(), "data", "sql");

async function main() {
  const manifest = JSON.parse(await readFile(join(dir, "manifest.json"), "utf8")) as { version: string; files: string[] };
  console.log(`Importing STEPBible-Data ${manifest.version} into D1 (${target}) — ${manifest.files.length} files`);
  for (const [i, f] of manifest.files.entries()) {
    process.stdout.write(`[${i + 1}/${manifest.files.length}] ${f} … `);
    execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "concornext", target, "--yes", "--file", join(dir, f)], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    process.stdout.write("ok\n");
  }
  console.log("Done.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
