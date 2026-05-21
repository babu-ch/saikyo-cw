export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  /** 確認対象のテキスト本文。指定すると引用風の別ブロックで表示される。 */
  preview?: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

const DIALOG_ID = "scw-confirm-dialog";
const STYLE_ID = "scw-confirm-dialog-style";

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${DIALOG_ID} {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 2147483646;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
    }
    #${DIALOG_ID} .scw-cd-card {
      background: #fff;
      border-radius: 8px;
      padding: 20px 22px 16px;
      min-width: 280px;
      max-width: 420px;
      box-shadow: 0 8px 28px rgba(0,0,0,.25);
    }
    #${DIALOG_ID} .scw-cd-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #222;
    }
    #${DIALOG_ID} .scw-cd-message {
      font-size: 13px;
      line-height: 1.6;
      color: #444;
      white-space: pre-wrap;
      margin-bottom: 12px;
    }
    #${DIALOG_ID} .scw-cd-preview {
      background: #f5f5f5;
      border-left: 3px solid #bbb;
      padding: 8px 12px;
      margin: 0 0 16px;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      white-space: pre-wrap;
      max-height: 140px;
      overflow-y: auto;
      border-radius: 0 4px 4px 0;
    }
    #${DIALOG_ID} .scw-cd-card.scw-cd-card--danger .scw-cd-preview {
      border-left-color: #d33;
    }
    #${DIALOG_ID} .scw-cd-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    #${DIALOG_ID} .scw-cd-btn {
      border: 1px solid #d0d0d0;
      background: #fff;
      color: #333;
      padding: 6px 16px;
      border-radius: 4px;
      font-size: 13px;
      cursor: pointer;
      min-width: 72px;
    }
    #${DIALOG_ID} .scw-cd-btn:hover { background: #f3f3f3; }
    #${DIALOG_ID} .scw-cd-btn:focus { outline: 2px solid #4a90e2; outline-offset: 1px; }
    #${DIALOG_ID} .scw-cd-btn--ok {
      background: #4a90e2;
      border-color: #4a90e2;
      color: #fff;
    }
    #${DIALOG_ID} .scw-cd-btn--ok:hover { background: #3b7bc8; }
    #${DIALOG_ID} .scw-cd-btn--danger {
      background: #d33;
      border-color: #d33;
      color: #fff;
    }
    #${DIALOG_ID} .scw-cd-btn--danger:hover { background: #b82828; }

    @media (prefers-color-scheme: dark) {
      #${DIALOG_ID} .scw-cd-card { background: #2a2a2a; }
      #${DIALOG_ID} .scw-cd-title { color: #f0f0f0; }
      #${DIALOG_ID} .scw-cd-message { color: #ccc; }
      #${DIALOG_ID} .scw-cd-preview {
        background: #1f1f1f;
        border-left-color: #555;
        color: #ddd;
      }
      #${DIALOG_ID} .scw-cd-btn:not(.scw-cd-btn--ok):not(.scw-cd-btn--danger) {
        background: #3a3a3a;
        border-color: #555;
        color: #eee;
      }
      #${DIALOG_ID} .scw-cd-btn:not(.scw-cd-btn--ok):not(.scw-cd-btn--danger):hover {
        background: #444;
      }
    }
  `;
  document.head.appendChild(style);
}

export function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  injectStyle();
  return new Promise((resolve) => {
    document.getElementById(DIALOG_ID)?.remove();

    const overlay = document.createElement("div");
    overlay.id = DIALOG_ID;

    const card = document.createElement("div");
    card.className = `scw-cd-card${options.danger ? " scw-cd-card--danger" : ""}`;

    if (options.title) {
      const title = document.createElement("div");
      title.className = "scw-cd-title";
      title.textContent = options.title;
      card.appendChild(title);
    }

    const msg = document.createElement("div");
    msg.className = "scw-cd-message";
    msg.textContent = options.message;
    card.appendChild(msg);

    if (options.preview) {
      const preview = document.createElement("div");
      preview.className = "scw-cd-preview";
      preview.textContent = options.preview;
      card.appendChild(preview);
    }

    const actions = document.createElement("div");
    actions.className = "scw-cd-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "scw-cd-btn";
    cancelBtn.textContent = options.cancelText ?? "キャンセル";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = `scw-cd-btn ${options.danger ? "scw-cd-btn--danger" : "scw-cd-btn--ok"}`;
    okBtn.textContent = options.okText ?? "OK";

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    card.appendChild(actions);
    overlay.appendChild(card);

    const close = (result: boolean) => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(false);
      }
    };

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    cancelBtn.addEventListener("click", () => close(false));
    okBtn.addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKey, true);

    document.body.appendChild(overlay);
    // 誤Enter防止のため、初期フォーカスはキャンセル側
    cancelBtn.focus();
  });
}
