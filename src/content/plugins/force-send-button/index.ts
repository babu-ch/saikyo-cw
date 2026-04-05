import type { CwPlugin } from "../types";
import { CW } from "../../../shared/chatwork-selectors";
import { insertAtCursor } from "../../../shared/react-input";
import { observeDOM } from "../../../shared/mutation-observer";

const CUSTOM_PLACEHOLDER =
  "ここにメッセージ内容を入力\n(拡張機能によりEnterは改行になっています。送信ボタンをクリックして送信)";

let checkboxObserver: MutationObserver | null = null;
let placeholderObserver: MutationObserver | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
let originalPlaceholder: string | null = null;

function uncheckEnterToSend(): void {
  const checkbox = document.querySelector<HTMLInputElement>(CW.ENTER_TO_SEND_CHECKBOX);
  if (checkbox && checkbox.checked) {
    checkbox.click();
  }
}

function applyPlaceholder(textarea: HTMLTextAreaElement): void {
  if (originalPlaceholder === null) {
    originalPlaceholder = textarea.placeholder;
  }
  if (textarea.placeholder !== CUSTOM_PLACEHOLDER) {
    textarea.placeholder = CUSTOM_PLACEHOLDER;
  }
}

function watchPlaceholder(textarea: HTMLTextAreaElement): void {
  applyPlaceholder(textarea);
  placeholderObserver = new MutationObserver(() => {
    applyPlaceholder(textarea);
  });
  placeholderObserver.observe(textarea, {
    attributes: true,
    attributeFilter: ["placeholder"],
  });
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== "Enter") return;
  if (e.isComposing) return;

  const target = e.target as HTMLElement;
  if (target.id !== "_chatText") return;

  // 「Enterで送信」がOFFの場合: Shift+Enterが送信トリガー → ブロック
  // 「Enterで送信」がONの場合: Enterが送信トリガー → ブロック
  const checkbox = document.querySelector<HTMLInputElement>(CW.ENTER_TO_SEND_CHECKBOX);
  const enterToSend = checkbox?.checked ?? false;

  // 送信トリガーになるキー操作をブロックして改行に変換
  // ON + Enter → 送信される → ブロック＋改行挿入
  // OFF + Shift+Enter → 送信される → ブロック＋改行挿入
  const isSendAction =
    (enterToSend && !e.shiftKey) || (!enterToSend && e.shiftKey);

  if (isSendAction) {
    e.preventDefault();
    e.stopPropagation();
    insertAtCursor(target as HTMLTextAreaElement, "\n");
  }
}

export const forceSendButtonPlugin: CwPlugin = {
  config: {
    id: "force-send-button",
    name: "送信ボタン強制",
    description:
      "Enterキーでの送信を無効化し、送信ボタンのクリックでのみ送信可能にします",
    defaultEnabled: false,
  },
  init() {
    // 「Enterで送信」チェックボックスを強制OFF
    uncheckEnterToSend();
    checkboxObserver = observeDOM(CW.ENTER_TO_SEND_CHECKBOX, () => {
      uncheckEnterToSend();
    });

    // キーボード送信をブロック
    keydownHandler = onKeydown;
    document.addEventListener("keydown", keydownHandler, true);

    // placeholder を変更（textareaが後から描画される場合にも対応）
    const textarea = document.querySelector<HTMLTextAreaElement>(CW.CHAT_INPUT);
    if (textarea) {
      watchPlaceholder(textarea);
    } else {
      const domObserver = observeDOM(CW.CHAT_INPUT, (el) => {
        watchPlaceholder(el as HTMLTextAreaElement);
        domObserver.disconnect();
      });
    }
  },
  destroy() {
    if (checkboxObserver) {
      checkboxObserver.disconnect();
      checkboxObserver = null;
    }
    if (placeholderObserver) {
      placeholderObserver.disconnect();
      placeholderObserver = null;
    }
    if (keydownHandler) {
      document.removeEventListener("keydown", keydownHandler, true);
      keydownHandler = null;
    }

    // placeholder を復元
    if (originalPlaceholder !== null) {
      const textarea = document.querySelector<HTMLTextAreaElement>(CW.CHAT_INPUT);
      if (textarea) {
        textarea.placeholder = originalPlaceholder;
      }
      originalPlaceholder = null;
    }
  },
};
