import { describe, expect, it } from "vitest";
import { parseChapter } from "~/server/bsb";

describe("parseChapter", () => {
  it("reads verses and keeps a Psalm title as verse 0", () => {
    const verses = parseChapter({
      chapter: {
        number: 51,
        content: [
          { type: "heading", text: "Create in Me a Clean Heart, O God" },
          { type: "hebrew_subtitle", text: "For the choirmaster. A Psalm of David." },
          { type: "line_break" },
          { type: "verse", number: 1, text: " Have mercy on me, O God " },
        ],
      },
    });
    expect([...verses]).toEqual([
      [0, "For the choirmaster. A Psalm of David."],
      [1, "Have mercy on me, O God"],
    ]);
  });
});
