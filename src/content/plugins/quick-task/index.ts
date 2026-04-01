import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { CW } from "../../../shared/chatwork-selectors";
import { injectMyTaskButton } from "./task-injector";

let observer: MutationObserver | null = null;

export const quickTaskPlugin: CwPlugin = {
  config: {
    id: "quick-task",
    name: "Quick Task",
    description: "メッセージにmy taskボタンを追加",
  },
  init() {
    // メッセージのアクションナビが表示されたらmy taskボタンを注入
    observer = observeDOM(CW.MESSAGE_ACTION_NAV, (el) => {
      injectMyTaskButton(el);
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    document
      .querySelectorAll("[data-scw-mytask]")
      .forEach((el) => el.remove());
  },
};
