import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { injectToolbar, removeToolbar } from "./toolbar";

let observer: MutationObserver | null = null;

export const inputToolsPlugin: CwPlugin = {
  config: {
    id: "input-tools",
    name: "Input Tools",
    description: "コードブロック・絵文字・装飾タグの挿入、TO全選択",
    defaultEnabled: true,
  },
  init() {
    // #_emoticon が現れたらその横にアイコンを注入
    observer = observeDOM("#_emoticon", () => {
      injectToolbar();
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    removeToolbar();
  },
};
