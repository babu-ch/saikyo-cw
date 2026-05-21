import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { CW } from "../../../shared/chatwork-selectors";
import { injectMyTaskButton, removeStyles } from "./task-injector";

let observer: MutationObserver | null = null;

export const quickTaskPlugin: CwPlugin = {
  config: {
    id: "quick-task",
    name: "Quick Task",
    description: "メッセージにmy taskボタンを追加。共通APIキーが設定されていればタスクAPI経由で登録（画面遷移なし）、未設定時はマイチャットへの画面遷移＆DOM操作で登録します",
    defaultEnabled: true,
  },
  init() {
    observer = observeDOM(CW.MESSAGE_ACTION_NAV, (el) => {
      injectMyTaskButton(el);
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    removeStyles();
    document
      .querySelectorAll(".scw-quick-task__btn")
      .forEach((el) => el.remove());
  },
};
