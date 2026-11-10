/**
 * Downloads the source files used by ConcorNext into data/raw/ and records the upstream
 * commit SHAs in data/raw/VERSION.json:
 *
 * - STEPBible-Data: TAGNT / TAHOT (tagged texts), TBESG / TBESH (lexicons), TEHMC (Hebrew morphology codes)
 * - openscriptures/HebrewLexicon: BDB outline and Strong's Hebrew dictionary (public-domain text, CC BY markup),
 *   used for Hebrew definitions instead of TBESH's Meaning column (Abridged BDB © Online Bible, not licensed to us)
 *
 *   pnpm data:download                 # latest STEPBible-Data master
 *   pnpm data:download <sha>           # a specific STEPBible-Data commit
 *   pnpm data:download <sha> <oshb>    # also pin the HebrewLexicon commit
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const REPO = "STEPBible/STEPBible-Data";
const TAHOT = (part: string) =>
  `Translators Amalgamated OT+NT/TAHOT ${part} - Translators Amalgamated Hebrew OT - STEPBible.org CC BY.txt`;
const FILES: Record<string, string> = {
  "TAGNT_Mat-Jhn.txt":
    "Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
  "TAGNT_Act-Rev.txt":
    "Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt",
  "TBESG.txt": "Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt",
  "TAHOT_Gen-Deu.txt": TAHOT("Gen-Deu"),
  "TAHOT_Jos-Est.txt": TAHOT("Jos-Est"),
  "TAHOT_Job-Sng.txt": TAHOT("Job-Sng"),
  "TAHOT_Isa-Mal.txt": TAHOT("Isa-Mal"),
  "TBESH.txt": "Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt",
  "TEHMC.txt":
    "Morphology codes/TEHMC - Translators Expansion of Hebrew Morphology Codes - STEPBible.org CC BY.txt",
};

const OSHB_REPO = "openscriptures/HebrewLexicon";
const OSHB_FILES = ["BrownDriverBriggs.xml", "HebrewStrong.xml", "LexicalIndex.xml", "AugIndex.xml"];

async function resolveCommit(repo: string, ref: string): Promise<{ sha: string; date: string }> {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${ref}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "concornext-importer" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { sha: string; commit: { committer: { date: string } } };
  return { sha: json.sha, date: json.commit.committer.date };
}

async function download(repo: string, sha: string, path: string, outFile: string) {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${path}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outFile, buf);
  console.log(`  ${outFile.split("/").pop()}  ${(buf.length / 1e6).toFixed(1)} MB`);
}

async function main() {
  const ref = process.argv[2] ?? "master";
  const oshbRef = process.argv[3] ?? "master";
  const outDir = join(process.cwd(), "data", "raw");
  await mkdir(outDir, { recursive: true });

  const { sha, date } = await resolveCommit(REPO, ref);
  console.log(`STEPBible-Data @ ${sha} (${date})`);
  for (const [name, path] of Object.entries(FILES)) await download(REPO, sha, path, join(outDir, name));

  const oshb = await resolveCommit(OSHB_REPO, oshbRef);
  console.log(`HebrewLexicon @ ${oshb.sha} (${oshb.date})`);
  for (const name of OSHB_FILES) await download(OSHB_REPO, oshb.sha, name, join(outDir, name));

  await writeFile(
    join(outDir, "VERSION.json"),
    JSON.stringify(
      {
        repo: REPO,
        sha,
        commitDate: date,
        hebrewLexicon: { repo: OSHB_REPO, sha: oshb.sha, commitDate: oshb.date },
        downloadedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
