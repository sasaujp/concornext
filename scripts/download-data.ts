/**
 * Downloads the STEPBible source files used by ConcorNext into data/raw/ and records
 * the upstream commit SHA in data/raw/VERSION.json.
 *
 *   pnpm data:download            # latest master
 *   pnpm data:download <sha>      # a specific commit
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO = "STEPBible/STEPBible-Data";
const FILES: Record<string, string> = {
  "TAGNT_Mat-Jhn.txt":
    "Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
  "TAGNT_Act-Rev.txt":
    "Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
  "TBESG.txt": "Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt",
};

async function resolveCommit(ref: string): Promise<{ sha: string; date: string }> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${ref}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "concornext-importer" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { sha: string; commit: { committer: { date: string } } };
  return { sha: json.sha, date: json.commit.committer.date };
}

async function main() {
  const ref = process.argv[2] ?? "master";
  const outDir = join(process.cwd(), "data", "raw");
  await mkdir(outDir, { recursive: true });
  const { sha, date } = await resolveCommit(ref);
  console.log(`STEPBible-Data @ ${sha} (${date})`);

  for (const [name, path] of Object.entries(FILES)) {
    const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${path}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(join(outDir, name), buf);
    console.log(`  ${name}  ${(buf.length / 1e6).toFixed(1)} MB`);
  }

  await writeFile(
    join(outDir, "VERSION.json"),
    JSON.stringify({ repo: REPO, sha, commitDate: date, downloadedAt: new Date().toISOString() }, null, 2) + "\n",
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
