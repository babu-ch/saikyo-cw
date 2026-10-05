import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStore } from "./setup";

vi.mock("../shared/toast", () => ({ showToast: vi.fn() }));

import {
  actionMenuPlugin,
  buildHiddenItemsSelector,
  buildMoreMenuSelector,
} from "../content/plugins/action-menu";
import { injectLinkCopyButton } from "../content/plugins/link-copy";
import { injectMyTaskButton } from "../content/plugins/quick-task/task-injector";
import { setPluginConfig } from "../shared/storage";

const STYLE_ID = "scw-action-menu-style";

function li(icon: string, label: string): string {
  return `<li><button class="actionButton"><span class="iconContainer"><svg><use href="#${icon}"></use></svg></span><span class="actionLabel">${label}</span></button></li>`;
}

// 他の人の発言のメニュー（実DOMの並びを簡略化したもの）
function setupActionNav(): Element {
  document.body.innerHTML = `
    <div id="_messageId67890" class="_message" data-rid="12345" data-mid="67890">
      <ul class="messageActionNav">
        ${li("icon_reply", "返信")}
        ${li("icon_reaction", "リアクション")}
        ${li("icon_quote", "引用")}
        ${li("icon_bookmark", "ブックマーク")}
        ${li("icon_task", "タスク")}
        ${li("icon_link", "リンク")}
        <li><span><button aria-label="このメッセージの返信文をAI下書きする"><span class="iconContainer"><svg><use href="#icon_aiDraft"></use></svg></span></button></span></li>
        <li><button class="moreActionButton"><span class="iconContainer"><svg><use href="#icon_more"></use></svg></span></button></li>
      </ul>
    </div>
  `;
  const nav = document.querySelector(".messageActionNav")!;
  injectMyTaskButton(nav);
  injectLinkCopyButton(nav);
  return nav;
}

function matchedLabels(selector: string): string[] {
  return Array.from(document.querySelectorAll(selector)).map(
    (el) =>
      el.querySelector(".actionLabel")?.textContent ??
      el.querySelector("button")?.getAttribute("aria-label") ??
      "",
  );
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe("buildHiddenItemsSelector", () => {
  it("非表示がなければ空文字", () => {
    expect(buildHiddenItemsSelector([])).toBe("");
  });

  it("指定した純正項目だけにマッチする", () => {
    setupActionNav();
    const selector = buildHiddenItemsSelector(["bookmark", "ai-draft"]);
    expect(matchedLabels(selector)).toEqual([
      "ブックマーク",
      "このメッセージの返信文をAI下書きする",
    ]);
  });

  it("純正の「タスク」を隠しても、同じアイコンをcloneした「my」は隠れない", () => {
    setupActionNav();
    const selector = buildHiddenItemsSelector(["task", "link"]);
    expect(matchedLabels(selector)).toEqual(["タスク", "リンク"]);
  });

  it("拡張のボタンや未知のIDは対象外", () => {
    expect(buildHiddenItemsSelector(["quick-task", "link-copy", "unknown"])).toBe("");
  });
});

describe("buildMoreMenuSelector", () => {
  // 「その他」のメニュー（ポータル）と、自分／他の人の発言のアクションメニュー
  function setupMoreMenus(): void {
    document.body.innerHTML = `
      <div id="_messageId1" class="_message">
        <ul class="messageActionNav">
          ${li("icon_edit", "編集")}
          <li class="more-mine"><button class="moreActionButton"><svg><use href="#icon_more"></use></svg></button></li>
        </ul>
      </div>
      <div id="_messageId2" class="_message">
        <ul class="messageActionNav">
          ${li("icon_reply", "返信")}
          <li class="more-others"><button class="moreActionButton"><svg><use href="#icon_more"></use></svg></button></li>
        </ul>
      </div>
      <div id="_wrapper"><div><ul>
        ${li("icon_copy", "コピー")}
        ${li("icon_unread", "未読")}
        ${li("icon_delete", "削除")}
      </ul></div></div>
    `;
  }

  function matched(selector: string): string[] {
    return Array.from(document.querySelectorAll(selector)).map(
      (el) => el.querySelector(".actionLabel")?.textContent ?? el.className,
    );
  }

  it("何も出していなければ空文字", () => {
    expect(buildMoreMenuSelector([])).toBe("");
  });

  it("出した項目だけ「その他」の中から隠す", () => {
    setupMoreMenus();
    expect(matched(buildMoreMenuSelector(["unread"]))).toEqual(["未読"]);
  });

  it("コピーと未読を出したら、他の人の発言の「その他」自体も隠す（自分の発言は削除が残るので隠さない）", () => {
    setupMoreMenus();
    expect(matched(buildMoreMenuSelector(["copy", "unread"]))).toEqual([
      "more-others",
      "コピー",
      "未読",
    ]);
  });

  it("削除も出したら、自分の発言の「その他」も隠す", () => {
    setupMoreMenus();
    expect(matched(buildMoreMenuSelector(["copy", "unread", "delete"]))).toEqual([
      "more-mine",
      "more-others",
      "コピー",
      "未読",
      "削除",
    ]);
  });
});

describe("actionMenuPlugin", () => {
  beforeEach(() => {
    resetStore();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    actionMenuPlugin.destroy();
    vi.restoreAllMocks();
  });

  it("保存済みの非表示項目をスタイルとして注入する", async () => {
    await setPluginConfig("action-menu", { hiddenItems: ["bookmark"] });
    actionMenuPlugin.init();
    await flush();

    const style = document.getElementById(STYLE_ID);
    expect(style?.textContent).toContain('use[href="#icon_bookmark"]');
    expect(style?.textContent).toContain("display: none !important");
  });

  it("設定の変更をすぐ反映し、全部表示に戻すとスタイルを外す", async () => {
    actionMenuPlugin.init();
    await flush();
    expect(document.getElementById(STYLE_ID)).toBeNull();

    await setPluginConfig("action-menu", { hiddenItems: ["task"] });
    expect(document.getElementById(STYLE_ID)?.textContent).toContain('use[href="#icon_task"]');

    await setPluginConfig("action-menu", { hiddenItems: [] });
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it("destroyでスタイルを外し、以後の設定変更に反応しない", async () => {
    await setPluginConfig("action-menu", { hiddenItems: ["bookmark"] });
    actionMenuPlugin.init();
    await flush();

    actionMenuPlugin.destroy();
    expect(document.getElementById(STYLE_ID)).toBeNull();

    await setPluginConfig("action-menu", { hiddenItems: ["task"] });
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it("「その他」から出す項目を「その他」の手前に並べ、変更もすぐ反映する", async () => {
    await setPluginConfig("action-menu", { shownMoreItems: ["unread", "copy"] });
    const nav = setupActionNav();
    actionMenuPlugin.init();
    await flush();

    const tail = Array.from(nav.querySelectorAll(":scope > li"))
      .slice(-3)
      .map((el) => el.querySelector("use")?.getAttribute("href"));
    expect(tail).toEqual(["#icon_copy", "#icon_unread", "#icon_more"]);

    await setPluginConfig("action-menu", { shownMoreItems: [] });
    expect(nav.querySelectorAll(".scw-action-menu__btn")).toHaveLength(0);
  });

  it("削除は自分の発言のメニューにだけ出す", async () => {
    await setPluginConfig("action-menu", { shownMoreItems: ["unread", "delete"] });
    document.body.innerHTML = `
      <div id="_messageId1" class="_message"><ul class="messageActionNav">
        ${li("icon_edit", "編集")}
        <li><button class="moreActionButton"><svg><use href="#icon_more"></use></svg></button></li>
      </ul></div>
      <div id="_messageId2" class="_message"><ul class="messageActionNav">
        ${li("icon_reply", "返信")}
        <li><button class="moreActionButton"><svg><use href="#icon_more"></use></svg></button></li>
      </ul></div>
    `;
    actionMenuPlugin.init();
    await flush();

    const [mine, others] = Array.from(document.querySelectorAll(".messageActionNav")).map((nav) =>
      Array.from(nav.querySelectorAll(".scw-action-menu__btn")).map((el) => el.querySelector(".actionLabel")?.textContent),
    );
    expect(mine).toEqual(["未読", "削除"]);
    expect(others).toEqual(["未読"]);
  });

  it("メッセージの外にあるメニューでも、自分が出した「未読」を「その他」と取り違えない", async () => {
    await setPluginConfig("action-menu", { shownMoreItems: ["unread"] });
    document.body.innerHTML = `
      <div class="somewhere"><ul class="messageActionNav">
        ${li("icon_reply", "返信")}
        <li><button class="moreActionButton"><svg><use href="#icon_more"></use></svg></button></li>
      </ul></div>
    `;
    let moreClicks = 0;
    document.querySelector(".moreActionButton")!.addEventListener("click", () => moreClicks++);
    actionMenuPlugin.init();
    await flush();

    (document.querySelector(".scw-action-menu__btn") as HTMLElement).click();
    // 「その他」が開かないので、待ち（1秒）が切れるまで待って次のテストに持ち越さない
    await new Promise((r) => setTimeout(r, 1100));
    expect(moreClicks).toBe(1);
    expect(document.querySelector<HTMLElement>(".somewhere")!.style.visibility).toBe("");
  });

  it("出した項目を押すと「その他」を開いて同じ項目を押す", async () => {
    await setPluginConfig("action-menu", { shownMoreItems: ["unread"] });
    const nav = setupActionNav();
    const clicked: string[] = [];
    nav.querySelector(".moreActionButton")!.addEventListener("click", () => {
      setTimeout(() => {
        const root = document.createElement("div");
        root.innerHTML = `<div><ul>
          <li><button><svg><use href="#icon_copy"></use></svg>コピー</button></li>
          <li><button><svg><use href="#icon_unread"></use></svg>未読</button></li>
        </ul></div>`;
        root.querySelectorAll("button").forEach((btn) =>
          btn.addEventListener("click", () => {
            clicked.push(btn.textContent ?? "");
            root.remove();
          }),
        );
        document.body.appendChild(root);
      }, 5);
    });
    actionMenuPlugin.init();
    await flush();

    (nav.querySelector(".scw-action-menu__btn") as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(clicked).toEqual(["未読"]);
  });
});
