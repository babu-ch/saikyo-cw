/**
 * chat-export のUIスタイル。
 * Chatworkのダーク/ライトモードに追従できるよう prefers-color-scheme メディアクエリで
 * 色を切り替える。Chrome拡張のCSPに配慮して inline style ではなく <style> 要素で注入する。
 */

const STYLE_ID = "scw-chat-export-styles";

const CSS = `
/* ===== CSV出力ボタン ===== */
.scw-chat-export-btn {
  margin-left: 8px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #cfd4da;
  border-radius: 4px;
  color: #333;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.scw-chat-export-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
.scw-chat-export-btn.is-running {
  border-color: #e03131;
  color: #c92a2a;
}
.scw-chat-export-btn.is-running:hover {
  background: rgba(224, 49, 49, 0.08);
}

/* ===== 出力ダイアログ ===== */
.scw-export-dialog {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2147483646;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.scw-export-dialog__card {
  background: #fff;
  color: #333;
  padding: 22px 24px 18px;
  border-radius: 10px;
  width: 460px;
  max-width: 92vw;
  box-sizing: border-box;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}
.scw-export-dialog__card * {
  box-sizing: border-box;
}
.scw-export-dialog__desc,
.scw-export-dialog__notice {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.scw-export-dialog__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
}
.scw-export-dialog__desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 10px;
  line-height: 1.5;
}
.scw-export-dialog__notice {
  font-size: 12px;
  color: #9e4b00;
  background: #fff5e5;
  border: 1px solid #ffd89e;
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 14px;
  line-height: 1.5;
}
.scw-export-dialog__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  user-select: none;
  margin-bottom: 10px;
}
.scw-export-dialog__toggle input {
  margin: 0;
  cursor: pointer;
}
.scw-export-dialog__range {
  display: none;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 6px;
}
.scw-export-dialog__range.is-open {
  display: flex;
}
.scw-export-dialog__row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.scw-export-dialog__row > span {
  font-size: 11px;
  color: #666;
}
.scw-export-dialog__row > input {
  padding: 5px 8px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font: inherit;
  background: #fff;
  color: #333;
}
.scw-export-dialog__hint {
  font-size: 11px;
  color: #888;
}
.scw-export-dialog__warn {
  font-size: 12px;
  color: #b00;
  min-height: 1em;
  margin-top: 10px;
  margin-bottom: 6px;
}
.scw-export-dialog__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
}
.scw-export-dialog__btn {
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
  border: 1px solid #ccc;
  background: #f6f6f6;
  color: #333;
}
.scw-export-dialog__btn--primary {
  padding: 7px 16px;
  border-color: #2b8a3e;
  background: #2b8a3e;
  color: #fff;
  font-weight: 600;
}

/* ===== ダークモード ===== */
@media (prefers-color-scheme: dark) {
  .scw-chat-export-btn {
    border-color: #4a5260;
    color: #e0e4ea;
  }
  .scw-chat-export-btn:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  .scw-chat-export-btn.is-running {
    border-color: #ff8787;
    color: #ffa8a8;
  }
  .scw-chat-export-btn.is-running:hover {
    background: rgba(255, 135, 135, 0.12);
  }

  .scw-export-dialog__card {
    background: #23272f;
    color: #e0e4ea;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
  }
  .scw-export-dialog__desc {
    color: #aeb4bd;
  }
  .scw-export-dialog__notice {
    color: #ffc078;
    background: rgba(255, 180, 80, 0.10);
    border-color: rgba(255, 180, 80, 0.35);
  }
  .scw-export-dialog__toggle {
    color: #e0e4ea;
  }
  .scw-export-dialog__range {
    background: #1b1e24;
  }
  .scw-export-dialog__row > span {
    color: #9ba2ab;
  }
  .scw-export-dialog__row > input {
    background: #2b3039;
    border-color: #3d434d;
    color: #e0e4ea;
  }
  .scw-export-dialog__row > input::-webkit-calendar-picker-indicator {
    filter: invert(0.85);
  }
  .scw-export-dialog__hint {
    color: #7f8691;
  }
  .scw-export-dialog__warn {
    color: #ff8787;
  }
  .scw-export-dialog__btn {
    background: #2b3039;
    border-color: #3d434d;
    color: #e0e4ea;
  }
  .scw-export-dialog__btn--primary {
    border-color: #37b24d;
    background: #37b24d;
    color: #fff;
  }
}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}
