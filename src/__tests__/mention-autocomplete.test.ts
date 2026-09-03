import { describe, it, expect, vi } from "vitest";

vi.stubGlobal("chrome", {
  storage: { sync: { get: vi.fn(), set: vi.fn() }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  runtime: { sendMessage: vi.fn() },
});

import { buildMentionText } from "../content/plugins/mention-autocomplete/autocomplete";

describe("buildMentionText", () => {
  const member = { account_id: "12345", name: "テスト太郎" };

  it("デフォルト（さん付き）はCW純正TOと同じ形式になる", () => {
    expect(buildMentionText(member, true)).toBe("[To:12345]テスト太郎さん\n");
  });

  it("さんOFFなら名前のみ", () => {
    expect(buildMentionText(member, false)).toBe("[To:12345]テスト太郎\n");
  });
});
