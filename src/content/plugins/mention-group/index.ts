import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { CW } from "../../../shared/chatwork-selectors";
import { injectGroupPicker } from "./group-picker";

let observer: MutationObserver | null = null;

export const mentionGroupPlugin: CwPlugin = {
  config: {
    id: "mention-group",
    name: "Mention Group",
    description: "グループメンションをワンクリックで挿入",
  },
  init() {
    // TOボタンの横にグループピッカーアイコンを注入
    observer = observeDOM(CW.TO_BUTTON, (el) => {
      injectGroupPicker(el);
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    document
      .querySelectorAll("[data-scw-mention-group]")
      .forEach((el) => el.remove());
  },
};
