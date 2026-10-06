import type { CwPlugin } from "../types";
import { observeActionNavs } from "../../../shared/mutation-observer";
import { BTN_CLASS, injectMyTaskButton, removeStyles } from "./task-injector";

let observer: MutationObserver | null = null;

export const quickTaskPlugin: CwPlugin = {
  config: {
    id: "quick-task",
    name: "Quick Task",
    description: "メッセージにmy taskボタンを追加。共通APIキーが設定されていればタスクAPI経由で登録（画面遷移なし）、未設定時はマイチャットへの画面遷移＆DOM操作で登録します",
    defaultEnabled: true,
  },
  init() {
    observer = observeActionNavs(injectMyTaskButton);
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    removeStyles();
    document
      .querySelectorAll(`.${BTN_CLASS}`)
      .forEach((el) => el.remove());
  },
};
