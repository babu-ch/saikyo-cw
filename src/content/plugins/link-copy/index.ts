import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { CW } from "../../../shared/chatwork-selectors";
import { CW_BASE_URL } from "../../../shared/constants";
import { showToast } from "../../../shared/toast";

const BTN_CLASS = "scw-link-copy__btn";

let observer: MutationObserver | null = null;

export function buildMessageLink(roomId: string, messageId: string): string | null {
  if (!/^\d+$/.test(roomId) || !/^\d+$/.test(messageId)) return null;
  return `${CW_BASE_URL}#!rid${roomId}-${messageId}`;
}

async function copyMessageLink(actionNav: Element): Promise<void> {
  const message = actionNav.closest(CW.MESSAGE);
  const link = buildMessageLink(
    message?.getAttribute("data-rid") ?? "",
    message?.getAttribute("data-mid") ?? "",
  );
  if (!link) {
    showToast("リンクを取得できませんでした");
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    showToast("リンクをコピーしました");
  } catch (e) {
    console.warn("[saikyo-cw][link-copy] copy failed:", e);
    showToast("コピーに失敗しました");
  }
}

// 純正の「リンク」はURLを入力欄に挿入するだけなので、その隣にクリップボードへコピーするボタンを置く
export function injectLinkCopyButton(actionNav: Element): void {
  if (actionNav.querySelector(`.${BTN_CLASS}`)) return;

  // 文言変更に備えてラベルではなくアイコンで「リンク」ボタンを探す
  const linkLi = actionNav.querySelector('use[href="#icon_link"]')?.closest("li");
  if (!linkLi) return;

  const cloned = linkLi.cloneNode(true) as HTMLElement;
  cloned.classList.add(BTN_CLASS);
  cloned.querySelector("use")?.setAttribute("href", "#icon_copy");
  const label = cloned.querySelector(".actionLabel");
  if (label) {
    label.textContent = "URL";
  }
  cloned.querySelector("button")?.setAttribute("title", "メッセージのリンクをコピー");
  linkLi.insertAdjacentElement("afterend", cloned);

  cloned.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    void copyMessageLink(actionNav);
  });
}

export const linkCopyPlugin: CwPlugin = {
  config: {
    id: "link-copy",
    name: "リンクコピー",
    description: "メッセージのアクションメニューに「URL」ボタンを追加し、ワンクリックでメッセージへのリンクをクリップボードにコピー",
    defaultEnabled: false,
  },
  init() {
    observer = observeDOM(CW.MESSAGE_ACTION_NAV, injectLinkCopyButton);
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove());
  },
};
