import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { injectGroupPicker, removeGroupPicker } from "./group-picker";

let observer: MutationObserver | null = null;

export const mentionGroupPlugin: CwPlugin = {
  config: {
    id: "mention-group",
    name: "Mention Group",
    description: "グループメンションをワンクリックで挿入",
  },
  init() {
    // #_emoticon が属するアイコン列<ul>を監視し、ツールバーにピルを注入
    observer = observeDOM("#_emoticon", () => {
      injectGroupPicker();
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    removeGroupPicker();
  },
};
