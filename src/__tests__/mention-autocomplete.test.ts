import { describe, it, expect, vi } from "vitest";

vi.stubGlobal("chrome", {
  storage: { sync: { get: vi.fn(), set: vi.fn() } },
  runtime: { sendMessage: vi.fn() },
});

import { buildMentionText } from "../content/plugins/mention-autocomplete/autocomplete";

describe("buildMentionText", () => {
  it("CW純正TOと同じ「[To:ID]名前さん」形式になる", () => {
    expect(buildMentionText({ account_id: "12345", name: "テスト太郎" })).toBe(
      "[To:12345]テスト太郎さん\n",
    );
  });
});
