import { describe, expect, it } from "vitest";
import { wrapCaption } from "./svgText";

describe("wrapCaption", () => {
  it("wraps long captions into two lines and ellipsizes overflow", () => {
    const lines = wrapCaption(
      "A very long caption with repeated words that should wrap into more than two lines and add an ellipsis at the end of the second line.",
    );

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.length <= 50)).toBe(true);
    expect(lines[1]).toMatch(/…$/);
  });

  it("keeps short captions on one line", () => {
    expect(wrapCaption("Short caption.")).toEqual(["Short caption."]);
  });
});
