import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { CW } from "../../../shared/chatwork-selectors";
import { injectToolbar } from "./toolbar";

let observer: MutationObserver | null = null;

export const inputToolsPlugin: CwPlugin = {
  config: {
    id: "input-tools",
    name: "Input Tools",
    description: "コードブロック・絵文字・装飾タグの挿入、TO全選択",
  },
  init() {
    observer = observeDOM(CW.CHAT_INPUT, (el) => {
      injectToolbar(el as HTMLTextAreaElement);
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    document
      .querySelectorAll("[data-scw-input-tools]")
      .forEach((el) => el.remove());
  },
};
