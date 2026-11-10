/**
 * Hebrew definitions from the Open Scriptures Hebrew Lexicon (github.com/openscriptures/HebrewLexicon):
 * an outline of Brown-Driver-Briggs and Strong's Hebrew dictionary. The BDB and Strong's texts are in
 * the public domain; the XML markup is CC BY 4.0 (credit: Open Scriptures Hebrew Bible Project).
 *
 * These replace TBESH's Meaning column, which is the Abridged BDB © Online Bible and needs permission.
 *
 * Linking: TBESH's extended Strong's (H1254a) → AugIndex ("1254a" → lexical-index id) → LexicalIndex
 * (→ BDB entry id) → BrownDriverBriggs.xml. Strong's entries are keyed by the plain number (H1254).
 * The files are regular, machine-written XML, so they are read with regular expressions.
 * Kept free of I/O so it can be unit-tested.
 */

/** Lexical-index id per augmented Strong's number ("1254a", "430"). */
export function parseAugIndex(xml: string): Map<string, string> {
  return new Map([...xml.matchAll(/<w aug="([^"]+)">([^<]+)<\/w>/g)].map(m => [m[1], m[2].trim()]));
}

/** BDB entry id per lexical-index id. */
export function parseLexicalIndex(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of xml.matchAll(/<entry id="([^"]+)">([\s\S]*?)<\/entry>/g)) {
    const bdb = m[2].match(/<xref [^>]*bdb="([^"]+)"/);
    if (bdb) out.set(m[1], bdb[1]);
  }
  return out;
}

/** Inner XML of every BDB entry, by id ("b.cw.aa"). */
export function parseBdb(xml: string): Map<string, string> {
  return new Map([...xml.matchAll(/<entry id="([^"]+)"[^>]*>([\s\S]*?)<\/entry>/g)].map(m => [m[1], m[2]]));
}

/** Inner XML of every Strong's Hebrew entry, by id ("H1254"). */
export function parseStrongsHebrew(xml: string): Map<string, string> {
  return new Map([...xml.matchAll(/<entry id="(H\d+)">([\s\S]*?)<\/entry>/g)].map(m => [m[1], m[2]]));
}

/** AugIndex key for a TBESH extended Strong's number: H1254a → "1254a", H0430 → "430". */
export function augKey(eStrong: string): string | null {
  const m = eStrong.match(/^H0*(\d+)([a-z]?)$/);
  return m ? m[1] + m[2] : null;
}

// OSIS book names used in the BDB references (plus a few misspellings in the data) → our book codes.
const OSIS_BOOKS: Record<string, string> = {
  Gen: "Gen", Exod: "Exo", Lev: "Lev", Num: "Num", Deut: "Deu", Josh: "Jos", Jos: "Jos", Judg: "Jdg", Jugd: "Jdg",
  Ruth: "Rut", "1Sam": "1Sa", "2Sam": "2Sa", "1Kgs": "1Ki", iKgs: "1Ki", "2Kgs": "2Ki", "1Chr": "1Ch", "1cHR": "1Ch",
  "2Chr": "2Ch", Ezra: "Ezr", Erz: "Ezr", Neh: "Neh", Esth: "Est", Job: "Job", Jb: "Job", Ps: "Psa", Prov: "Pro",
  Eccl: "Ecc", Song: "Sng", Isa: "Isa", Is: "Isa", Jer: "Jer", Lam: "Lam", Ezek: "Ezk", Ez: "Ezk", Dan: "Dan",
  Hos: "Hos", Hosea: "Hos", Ho: "Hos", Joel: "Jol", Amos: "Amo", Obad: "Oba", Jonah: "Jon", Mic: "Mic", Nah: "Nam",
  Hab: "Hab", Zeph: "Zep", Zp: "Zep", Hag: "Hag", Zech: "Zec", Zec: "Zec", Mal: "Mal", Matt: "Mat", Luke: "Luk",
};

/** "Num.21.30" → "Num.21.30" in our codes ("Deut.4.26" → "Deu.4.26"); null when the book is unknown. */
export function osisToRef(osis: string): string | null {
  const m = osis.match(/^([1-3]?[A-Za-z]+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  const code = OSIS_BOOKS[m[1]];
  return code ? `${code}.${m[2]}${m[3] ? `.${m[3]}` : ""}` : null;
}

const hebrewSpan = (s: string) => `<span class="he" lang="he" dir="rtl">${s}</span>`;

/**
 * BDB entry XML → HTML for the lexicon panel: Hebrew words in RTL spans, definitions bold, parts of speech,
 * stems' aspects and foreign words italic, senses as nested blocks, references as `span.ref[data-ref]`.
 */
export function bdbToHtml(inner: string): string {
  return inner
    .replace(/<status[^>]*>[\s\S]*?<\/status>/g, "")
    .replace(/<page[^>]*\/>/g, "")
    .replace(/<w[^>]*\/>/g, "")
    .replace(/<w[^>]*>([\s\S]*?)<\/w>/g, (_, t) => hebrewSpan(t.trim()))
    .replace(/<def>([\s\S]*?)<\/def>/g, "<b>$1</b>")
    .replace(/<stem>([\s\S]*?)<\/stem>/g, '<b class="stem">$1</b>')
    .replace(/<(pos|asp|em)>([\s\S]*?)<\/\1>/g, "<i>$2</i>")
    .replace(/<foreign[^>]*>([\s\S]*?)<\/foreign>/g, "<i>$1</i>")
    .replace(/<ref r="([^"]*)">([\s\S]*?)<\/ref>/g, (_, r, t) => {
      const ref = osisToRef(r);
      return ref ? `<span class="ref" data-ref="${ref}">${t}</span>` : `<span class="ref">${t}</span>`;
    })
    .replace(/<sense n="([^"]*)">/g, '<div class="sense"><b>$1</b> ')
    .replace(/<sense>/g, '<div class="sense">')
    .replace(/<\/sense>/g, "</div>")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strong's entry XML → one HTML paragraph: derivation, meaning, KJV renderings. */
export function strongsToHtml(inner: string): string {
  const pick = (tag: string) => inner.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
  const inline = (s: string) =>
    s
      .replace(/<w src="(H\d+)">[^<]*<\/w>/g, (_, id) => `<span class="strongs">${id}</span>`)
      .replace(/<w[^>]*>([\s\S]*?)<\/w>/g, (_, t) => hebrewSpan(t.trim()))
      .replace(/<def>([\s\S]*?)<\/def>/g, "<b>$1</b>")
      .replace(/\s+/g, " ")
      .trim();
  const parts = [inline(pick("source")), inline(pick("meaning")), inline(pick("note"))].filter(Boolean);
  const usage = inline(pick("usage"));
  return [parts.join(" "), usage ? `<i>KJV:</i> ${usage}` : ""].filter(Boolean).join(" — ");
}

export interface HebrewLexicon {
  aug: Map<string, string>;
  index: Map<string, string>;
  bdb: Map<string, string>;
  strongs: Map<string, string>;
}

/** The BDB entry id for a TBESH extended Strong's number, trying "1254a", then "1254" / "1254a" variants. */
export function bdbIdFor(lex: HebrewLexicon, eStrong: string): string | null {
  const key = augKey(eStrong);
  if (!key) return null;
  const base = key.replace(/[a-z]$/, "");
  for (const k of [key, `${base}a`, base]) {
    const li = lex.aug.get(k);
    const bdb = li ? lex.index.get(li) : undefined;
    if (bdb && lex.bdb.has(bdb)) return bdb;
  }
  return null;
}

/**
 * Definition HTML for a Hebrew/Aramaic lemma: the BDB outline (when linked) and Strong's entry, each under
 * a small heading. Null when neither exists (e.g. pronoun suffixes H9030–H9039).
 */
export function hebrewDefinitionHtml(lex: HebrewLexicon, eStrong: string | null, strongsBase: string): string | null {
  const sections: string[] = [];
  const bdbId = eStrong ? bdbIdFor(lex, eStrong) : null;
  if (bdbId) sections.push(`<p class="lex-src">BDB（Open Scriptures 版の概要）</p><div class="bdb">${bdbToHtml(lex.bdb.get(bdbId)!)}</div>`);
  const strongsId = `H${Number(strongsBase.slice(1))}`;
  const strongs = lex.strongs.get(strongsId);
  if (strongs) sections.push(`<p class="lex-src">Strong's ${strongsId}</p><div class="strongs-entry">${strongsToHtml(strongs)}</div>`);
  return sections.length ? sections.join("") : null;
}
