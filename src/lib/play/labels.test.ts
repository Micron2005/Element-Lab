import { describe, expect, it } from "vitest";
import { tr } from "../i18n";
import { PLAY_PRODUCT_LABEL_KEYS } from "./labels";

describe("Play product labels", () => {
  it("localizes every product id", () => {
    for (const key of Object.values(PLAY_PRODUCT_LABEL_KEYS)) {
      expect(tr("es", key)).not.toBe(tr("en", key));
    }
    expect(tr("es", "play.ui.molecularShape")).toBe("Forma molecular");
    expect(tr("es", "play.ui.molecularShape")).not.toContain("::");
  });
});
