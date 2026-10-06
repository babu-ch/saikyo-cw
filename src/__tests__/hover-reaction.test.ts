import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStore } from "./setup";
import { hoverReactionPlugin } from "../content/plugins/hover-reaction";
import { setPluginConfig } from "../shared/storage";
import { ALL_REACTIONS } from "../shared/reactions";

const QUICK = ["emo_roger.gif", "emo_bow.gif", "emo_cracker.gif", "emo_dance.gif", "emo_clap.gif", "emo_yes.gif"];

function li(icon: string, label: string): string {
  return `<li><button class="actionButton"><span class="iconContainer"><svg><use href="#${icon}"></use></svg></span><span class="actionLabel">${label}</span></button></li>`;
}

// CWのリアクション小窓・すべての一覧の動きを模したもの。押されたリアクションを記録する
// メッセージ下のリアクション。mine=trueなら自分が押しているもの
function badge(emoticon: string, mine: boolean): string {
  const label = mine ? "このリアクションを取り消す" : "同じリアクションをする";
  return `<div data-testid="timeline_message_reaction_result-reaction" aria-label="${label}"><img src="https://assets.example.com/images/emoticon2x/${emoticon}"><p>1</p></div>`;
}

function setupChatwork(clicked: string[], badges = ""): Element {
  document.body.innerHTML = `
    <div id="_wrapper">
      <div id="_messageId67890" class="_message" data-rid="12345" data-mid="67890">
        <ul class="messageActionNav">
          ${li("icon_reply", "返信")}
          ${li("icon_reaction", "リアクション")}
          ${li("icon_quote", "引用")}
        </ul>
        <div class="reactions">${badges}</div>
      </div>
    </div>
  `;
  document.querySelectorAll('[data-testid="timeline_message_reaction_result-reaction"]').forEach((el) =>
    el.addEventListener("click", () => {
      clicked.push(`badge:${el.querySelector("img")!.getAttribute("src")!.split("/").pop()}`);
    }),
  );
  const wrapper = document.getElementById("_wrapper")!;

  function openPopup(list: HTMLElement): HTMLElement {
    const root = document.createElement("div");
    root.className = "popup-root";
    root.appendChild(list);
    wrapper.appendChild(root);
    return root;
  }

  function reactionButton(emoticon: string, imgInside: boolean, root: () => HTMLElement): HTMLElement {
    const item = document.createElement("li");
    const btn = document.createElement("button");
    const img = document.createElement("img");
    img.src = `https://assets.example.com/images/emoticon2x/${emoticon}`;
    if (imgInside) {
      btn.appendChild(img);
      item.appendChild(btn);
    } else {
      item.append(btn, img);
    }
    btn.addEventListener("click", () => {
      clicked.push(emoticon);
      root().remove();
    });
    return item;
  }

  const nativeBtn = document.querySelector('use[href="#icon_reaction"]')!.closest("button")!;
  nativeBtn.addEventListener("click", () => {
    const quick = document.createElement("ul");
    quick.setAttribute("data-testid", "reaction-list");
    let quickRoot: HTMLElement;
    for (const e of QUICK) quick.appendChild(reactionButton(e, false, () => quickRoot));
    const moreItem = document.createElement("li");
    moreItem.innerHTML = `<button aria-label="すべてのリアクションを見る"><svg><use href="#icon_more"></use></svg></button>`;
    moreItem.querySelector("button")!.addEventListener("click", () => {
      quickRoot.remove();
      const all = document.createElement("ul");
      let allRoot: HTMLElement;
      for (const r of ALL_REACTIONS) all.appendChild(reactionButton(r.emoticon, true, () => allRoot));
      setTimeout(() => {
        allRoot = openPopup(all);
      }, 5);
    });
    quick.appendChild(moreItem);
    setTimeout(() => {
      quickRoot = openPopup(quick);
    }, 5);
  });

  return document.querySelector(".messageActionNav")!;
}

function labels(nav: Element): string[] {
  return Array.from(nav.querySelectorAll(":scope > li")).map(
    (el) => el.querySelector("button")?.getAttribute("aria-label") ?? el.textContent?.trim() ?? "",
  );
}

async function flush(ms = 0): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("hoverReactionPlugin", () => {
  let clicked: string[];

  beforeEach(() => {
    resetStore();
    document.head.innerHTML = "";
    clicked = [];
  });

  afterEach(() => {
    hoverReactionPlugin.destroy();
    vi.restoreAllMocks();
  });

  describe("メニューの下の段（従来・初期値）", () => {
    function row(nav: Element): HTMLElement | null {
      const next = nav.nextElementSibling as HTMLElement | null;
      return next?.classList.contains("scw-hover-reaction-row") ? next : null;
    }

    it("未設定なら従来どおりメニューの下に6種を右寄せで出し、純正の「リアクション」はそのまま", async () => {
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();

      const r = row(nav)!;
      expect(Array.from(r.querySelectorAll("button")).map((b) => b.getAttribute("aria-label"))).toEqual([
        "了解",
        "ありがとう",
        "おめでとう",
        "わーい",
        "すごい",
        "いいね",
      ]);
      expect(r.style.right).toBe("0px");
      expect(labels(nav)).toEqual(["返信", "リアクション", "引用"]);
      expect(document.getElementById("scw-hover-reaction-style")?.textContent).not.toContain("actionLabel");
    });

    it("左寄せの設定を引き継ぐ", async () => {
      await setPluginConfig("hover-reaction", { alignment: "left" });
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();

      expect(row(nav)!.style.left).toBe("0px");
    });

    it("従来どおり小窓から送り、押している表示も付けない", async () => {
      const nav = setupChatwork(clicked, badge("emo_bow.gif", true));
      hoverReactionPlugin.init();
      await flush();

      const bow = row(nav)!.querySelector('[aria-label="ありがとう"]') as HTMLElement;
      expect(row(nav)!.querySelector(".scw-hover-reaction__btn--active")).toBeNull();
      bow.click();
      await flush(50);
      expect(clicked).toEqual(["emo_bow.gif"]);
    });
  });

  describe("リアクションの位置に並べる（display: inline）", () => {
    beforeEach(async () => {
      await setPluginConfig("hover-reaction", { display: "inline" });
    });

    it("未設定なら純正の「リアクション」の手前にCWの6種を並べる", async () => {
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();

      expect(labels(nav)).toEqual([
        "返信",
        "了解する人",
        "おじぎする人",
        "クラッカー",
        "踊る人",
        "拍手する人",
        "親指を上げた手",
        "リアクション",
        "引用",
      ]);
    });

    it("設定した順に並べ、変更もすぐ反映する", async () => {
      await setPluginConfig("hover-reaction", { display: "inline", reactions: ["emo_think.gif", "emo_yes.gif"] });
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();
      expect(labels(nav).slice(1, 3)).toEqual(["考えている顔", "親指を上げた手"]);

      await setPluginConfig("hover-reaction", { display: "inline", reactions: ["emo_beer.gif"] });
      expect(labels(nav)).toEqual(["返信", "ビール", "リアクション", "引用"]);
    });

    it("空にするとボタンを並べず、純正のラベルも隠さない", async () => {
      await setPluginConfig("hover-reaction", { display: "inline", reactions: [] });
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();

      expect(labels(nav)).toEqual(["返信", "リアクション", "引用"]);
      expect(document.getElementById("scw-hover-reaction-style")).toBeNull();
    });

    it("小窓にあるリアクションは小窓から送る", async () => {
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();

      (nav.querySelector('[aria-label="おじぎする人"]') as HTMLElement).click();
      await flush(50);
      expect(clicked).toEqual(["emo_bow.gif"]);
    });

    it("小窓にないリアクションは「すべてのリアクション」から送る", async () => {
      await setPluginConfig("hover-reaction", { display: "inline", reactions: ["emo_think.gif"] });
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();

      (nav.querySelector('[aria-label="考えている顔"]') as HTMLElement).click();
      await flush(50);
      expect(clicked).toEqual(["emo_think.gif"]);
    });

    it("destroyでボタンとスタイルを外す", async () => {
      const nav = setupChatwork(clicked);
      hoverReactionPlugin.init();
      await flush();
      hoverReactionPlugin.destroy();

      expect(labels(nav)).toEqual(["返信", "リアクション", "引用"]);
      expect(document.getElementById("scw-hover-reaction-style")).toBeNull();
    });

    describe("自分が押しているリアクション", () => {
      function activeLabels(nav: Element): string[] {
        return Array.from(nav.querySelectorAll(".scw-hover-reaction__btn--active")).map(
          (el) => el.querySelector("button")?.getAttribute("aria-label") ?? "",
        );
      }

      it("メッセージ下の自分のリアクションと同じものを押している状態にする", async () => {
        const nav = setupChatwork(clicked, badge("emo_bow.gif", true) + badge("emo_yes.gif", false));
        hoverReactionPlugin.init();
        await flush();

        expect(activeLabels(nav)).toEqual(["おじぎする人"]);
        expect(
          nav.querySelector('[aria-label="おじぎする人"]')?.getAttribute("aria-pressed"),
        ).toBe("true");
      });

      it("純正の側で付け外ししても追従する", async () => {
        const nav = setupChatwork(clicked, badge("emo_bow.gif", true));
        hoverReactionPlugin.init();
        await flush();

        const bow = document.querySelector('[data-testid="timeline_message_reaction_result-reaction"]')!;
        bow.setAttribute("aria-label", "同じリアクションをする");
        await flush();
        expect(activeLabels(nav)).toEqual([]);

        nav.parentElement!.querySelector(".reactions")!.insertAdjacentHTML("beforeend", badge("emo_clap.gif", true));
        await flush();
        expect(activeLabels(nav)).toEqual(["拍手する人"]);
      });

      it("メッセージ下に同じリアクションがあれば、小窓を開かずにそれを押す", async () => {
        const nav = setupChatwork(clicked, badge("emo_bow.gif", true) + badge("emo_yes.gif", false));
        hoverReactionPlugin.init();
        await flush();

        (nav.querySelector('[aria-label="おじぎする人"]') as HTMLElement).click();
        (nav.querySelector('[aria-label="親指を上げた手"]') as HTMLElement).click();
        await flush(50);
        expect(clicked).toEqual(["badge:emo_bow.gif", "badge:emo_yes.gif"]);
        expect(document.querySelector('[data-testid="reaction-list"]')).toBeNull();
      });
    });
  });

  describe("押す前から同じ形の小窓・一覧が残っているとき", () => {
    // 別のメッセージの小窓や、入力欄側の絵文字一覧などを模したもの
    function appendStale(list: HTMLElement): void {
      list.querySelectorAll("button").forEach((btn) =>
        btn.addEventListener("click", () => clicked.push("前から残っている")),
      );
      const root = document.createElement("div");
      root.appendChild(list);
      document.getElementById("_wrapper")!.appendChild(root);
    }

    it("小窓は押した後に開いたものから送る", async () => {
      const nav = setupChatwork(clicked);
      const stale = document.createElement("ul");
      stale.setAttribute("data-testid", "reaction-list");
      stale.innerHTML = `<li><button aria-label="ありがとう"></button></li>`;
      appendStale(stale);
      hoverReactionPlugin.init();
      await flush();

      (nav.nextElementSibling!.querySelector('[aria-label="ありがとう"]') as HTMLElement).click();
      await flush(50);
      expect(clicked).toEqual(["emo_bow.gif"]);
    });

    it("「すべてのリアクション」は押した後に開いた一覧から送る", async () => {
      await setPluginConfig("hover-reaction", { display: "inline", reactions: ["emo_think.gif"] });
      const nav = setupChatwork(clicked);
      const stale = document.createElement("ul");
      stale.innerHTML = ALL_REACTIONS.map(
        (r) => `<li><button><img src="https://assets.example.com/images/emoticon2x/${r.emoticon}"></button></li>`,
      ).join("");
      appendStale(stale);
      hoverReactionPlugin.init();
      await flush();

      (nav.querySelector('[aria-label="考えている顔"]') as HTMLElement).click();
      await flush(50);
      expect(clicked).toEqual(["emo_think.gif"]);
    });
  });
});
