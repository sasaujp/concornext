import { describe, expect, it } from "vitest";
import { augKey, bdbIdFor, bdbToHtml, hebrewDefinitionHtml, osisToRef, parseAugIndex, parseBdb, parseLexicalIndex, parseStrongsHebrew, strongsToHtml } from "../scripts/oshb";

const AUG = `<index><w aug="1254a">bxy</w><w aug="1254b">bxx</w><w aug="430">arn</w></index>`;
const INDEX = `<index><part xml:lang="heb">
  <entry id="bxy"><w xlit="bārāʾ">בָּרָא</w> <pos>V</pos> <def>shape</def>
    <xref bdb="b.cw.aa" strong="1254" aug="a" twot="278"/><etym root="ברא" type="main">byx</etym></entry>
  <entry id="arn"><w>אֱלֹהִים</w><xref bdb="a.dn.ac" strong="430"/></entry>
</part></index>`;
const BDB = `<lexicon><part id="b">
  <entry id="b.cw.aa" type="root" cite="full" mod="I"><w>בָּרָא</w> 53 <pos>vb</pos>. <def>shape</def>, <def>create</def>
    <sense><stem>Qal</stem> <asp>Pf</asp>.—<def>create</def> <ref r="Gen.1.1">Gn 1:1</ref> <ref r="Deut.4.32">Dt 4:32</ref></sense>
    <sense><stem>Niph</stem>.<sense n="1"><def>be created</def></sense></sense>
    <status p="135">base</status>
  </entry>
</part></lexicon>`;
const STRONGS = `<lexicon>
  <entry id="H1254">
    <w pos="v" pron="baw-raw'" xlit="bârâʼ" xml:lang="heb">בָּרָא</w>
    <source>a primitive root;</source>
    <meaning>(absolutely) to <def>create</def>; compare <w src="H1255">1255</w></meaning>
    <usage>choose, create (creator).</usage>
  </entry>
</lexicon>`;
const lex = { aug: parseAugIndex(AUG), index: parseLexicalIndex(INDEX), bdb: parseBdb(BDB), strongs: parseStrongsHebrew(STRONGS) };

describe("Open Scriptures Hebrew lexicon", () => {
  it("links TBESH extended Strong's numbers to BDB entries", () => {
    expect(augKey("H1254a")).toBe("1254a");
    expect(augKey("H0430")).toBe("430");
    expect(bdbIdFor(lex, "H1254a")).toBe("b.cw.aa");
    expect(bdbIdFor(lex, "H1254")).toBe("b.cw.aa"); // no letter: falls back to "a"
    expect(bdbIdFor(lex, "H0430")).toBeNull(); // index points to a BDB entry that is not in the file
  });

  it("maps OSIS references to our book codes", () => {
    expect(osisToRef("Deut.4.32")).toBe("Deu.4.32");
    expect(osisToRef("Ps.10.16")).toBe("Psa.10.16");
    expect(osisToRef("1Kgs.2.3")).toBe("1Ki.2.3");
    expect(osisToRef("Foo.1.1")).toBeNull();
  });

  it("renders a BDB entry as HTML", () => {
    const html = bdbToHtml(lex.bdb.get("b.cw.aa")!);
    expect(html).toContain('<span class="he" lang="he" dir="rtl">בָּרָא</span> 53 <i>vb</i>. <b>shape</b>, <b>create</b>');
    expect(html).toContain('<div class="sense"><b class="stem">Qal</b> <i>Pf</i>.—<b>create</b>');
    expect(html).toContain('<span class="ref" data-ref="Gen.1.1">Gn 1:1</span>');
    expect(html).toContain('<span class="ref" data-ref="Deu.4.32">Dt 4:32</span>');
    expect(html).toContain('<div class="sense"><b>1</b> <b>be created</b></div>');
    expect(html).not.toContain("status");
    expect(html).not.toContain("base");
  });

  it("renders a Strong's entry as one paragraph", () => {
    expect(strongsToHtml(lex.strongs.get("H1254")!)).toBe(
      'a primitive root; (absolutely) to <b>create</b>; compare <span class="strongs">H1255</span> — <i>KJV:</i> choose, create (creator).',
    );
  });

  it("combines BDB and Strong's, and returns null when neither exists", () => {
    const html = hebrewDefinitionHtml(lex, "H1254a", "H1254")!;
    expect(html.indexOf("BDB")).toBeLessThan(html.indexOf("Strong's H1254"));
    expect(hebrewDefinitionHtml(lex, null, "H9033")).toBeNull();
  });
});
