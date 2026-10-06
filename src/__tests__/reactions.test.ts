import { describe, it, expect } from "vitest";
import { ALL_REACTIONS, DEFAULT_REACTIONS, resolveReactions } from "../shared/reactions";

describe("reactions", () => {
  it("CWのリアクション49種を重複なく持つ", () => {
    expect(ALL_REACTIONS).toHaveLength(49);
    expect(new Set(ALL_REACTIONS.map((r) => r.emoticon)).size).toBe(49);
  });

  it("初期値はすべて一覧にある", () => {
    const all = new Set(ALL_REACTIONS.map((r) => r.emoticon));
    expect(DEFAULT_REACTIONS.every((e) => all.has(e))).toBe(true);
  });

  describe("resolveReactions", () => {
    it("未設定なら初期値の6種", () => {
      expect(resolveReactions(undefined).map((r) => r.emoticon)).toEqual(DEFAULT_REACTIONS);
    });

    it("設定した順に返し、未知・重複は除く", () => {
      expect(
        resolveReactions(["emo_think.gif", "emo_unknown.gif", "emo_bow.gif", "emo_think.gif"]).map(
          (r) => r.emoticon,
        ),
      ).toEqual(["emo_think.gif", "emo_bow.gif"]);
    });

    it("空の設定なら空", () => {
      expect(resolveReactions([])).toEqual([]);
    });
  });
});
