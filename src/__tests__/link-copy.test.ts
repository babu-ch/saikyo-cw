import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../shared/toast", () => ({ showToast: vi.fn() }));

import { buildMessageLink, injectLinkCopyButton } from "../content/plugins/link-copy";
import { showToast } from "../shared/toast";

function setupMessage(rid = "12345", mid = "67890"): Element {
  document.body.innerHTML = `
    <div id="_messageId${mid}" class="_message" data-rid="${rid}" data-mid="${mid}">
      <ul class="messageActionNav">
        <li><button class="actionButton"><span class="iconContainer"><svg><use href="#icon_task"></use></svg></span><span class="actionLabel">タスク</span></button></li>
        <li><button class="actionButton"><span class="iconContainer"><svg><use href="#icon_link"></use></svg></span><span class="actionLabel">リンク</span></button></li>
        <li><button class="actionButton"><span class="iconContainer"><svg><use href="#icon_more"></use></svg></span></button></li>
      </ul>
    </div>
  `;
  return document.querySelector(".messageActionNav")!;
}

describe("buildMessageLink", () => {
  it("ルームIDとメッセージIDからメッセージへのリンクを作る", () => {
    expect(buildMessageLink("12345", "67890")).toBe(
      "https://www.chatwork.com/#!rid12345-67890",
    );
  });

  it("数字以外を含むIDはnullを返す", () => {
    expect(buildMessageLink("12345", "")).toBeNull();
    expect(buildMessageLink("12a45", "67890")).toBeNull();
    expect(buildMessageLink("12345", "67890&x=1")).toBeNull();
  });
});

describe("injectLinkCopyButton", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    vi.mocked(showToast).mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("「リンク」の右隣にコピーアイコンの「リンクをコピー」ボタンを追加する", () => {
    const nav = setupMessage();
    injectLinkCopyButton(nav);

    const labels = Array.from(nav.querySelectorAll(":scope > li")).map(
      (li) => li.textContent?.trim(),
    );
    expect(labels).toEqual(["タスク", "リンク", "リンクをコピー", ""]);
    const btn = nav.querySelector(".scw-link-copy__btn")!;
    expect(btn.querySelector("use")?.getAttribute("href")).toBe("#icon_copy");
  });

  it("2回呼んでもボタンは1つだけ", () => {
    const nav = setupMessage();
    injectLinkCopyButton(nav);
    injectLinkCopyButton(nav);
    expect(nav.querySelectorAll(".scw-link-copy__btn")).toHaveLength(1);
  });

  it("「リンク」ボタンがないメニューには追加しない", () => {
    const nav = setupMessage();
    nav.querySelector('use[href="#icon_link"]')!.closest("li")!.remove();
    injectLinkCopyButton(nav);
    expect(nav.querySelector(".scw-link-copy__btn")).toBeNull();
  });

  it("クリックでメッセージへのリンクをクリップボードにコピーする", async () => {
    const nav = setupMessage();
    injectLinkCopyButton(nav);
    nav.querySelector<HTMLElement>(".scw-link-copy__btn button")!.click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(writeText).toHaveBeenCalledWith("https://www.chatwork.com/#!rid12345-67890");
    expect(showToast).toHaveBeenCalledWith("リンクをコピーしました");
  });

  it("コピーに失敗したら失敗を通知する", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const nav = setupMessage();
    injectLinkCopyButton(nav);
    nav.querySelector<HTMLElement>(".scw-link-copy__btn button")!.click();
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());

    expect(showToast).toHaveBeenCalledWith("コピーに失敗しました");
  });
});
