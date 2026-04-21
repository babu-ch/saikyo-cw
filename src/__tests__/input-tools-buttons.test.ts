import { describe, it, expect } from "vitest";
import { ALL_BUTTON_METAS } from "../shared/input-tools-buttons";
import { getAction } from "../content/plugins/input-tools/buttons";

describe("input-tools buttons", () => {
  it("ALL_BUTTON_METASの全IDに対応するactionが存在する", () => {
    const missing = ALL_BUTTON_METAS
      .map((m) => m.id)
      .filter((id) => !getAction(id));
    expect(missing).toEqual([]);
  });

  it("ALL_BUTTON_METASのIDは重複しない", () => {
    const ids = ALL_BUTTON_METAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
