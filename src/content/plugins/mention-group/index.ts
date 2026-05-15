import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { injectGroupPicker, injectAddToGroupButton, removeGroupPicker } from "./group-picker";

let toolbarObserver: MutationObserver | null = null;
let profileObserver: MutationObserver | null = null;

export const mentionGroupPlugin: CwPlugin = {
  config: {
    id: "mention-group",
    name: "Mention Group",
    description: "グループメンションをワンクリックで挿入",
    defaultEnabled: true,
  },
  init() {
    // ツールバーにクイックメンションボタンを注入
    toolbarObserver = new MutationObserver(() => {
      if (!document.getElementById("scw-mention-group-btn")) {
        injectGroupPicker();
      }
    });
    toolbarObserver.observe(document.body, { childList: true, subtree: true });
    injectGroupPicker();
    setTimeout(injectGroupPicker, 1000);
    setTimeout(injectGroupPicker, 3000);

    // プロフィールカードに「グループに追加」ボタンを注入
    profileObserver = observeDOM(
      '[data-testid="profile-popup_profile-button"]',
      (el) => {
        injectAddToGroupButton(el);
      },
    );
  },
  destroy() {
    toolbarObserver?.disconnect();
    toolbarObserver = null;
    profileObserver?.disconnect();
    profileObserver = null;
    removeGroupPicker();
  },
};
