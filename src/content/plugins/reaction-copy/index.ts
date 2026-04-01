import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";

const CONTAINER_CLASS = "scw-reaction-copy";
const BUTTON_CLASS = "scw-reaction-copy__button";
const BUTTON_TO_CLASS = "scw-reaction-copy__button--to";
const STYLE_ID = "scw-reaction-copy-style";

let observer: MutationObserver | null = null;

const STYLES = `
  .${CONTAINER_CLASS} {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }

  .${BUTTON_CLASS} {
    padding: 4px;
    font-size: 12px;
    background-color: #eee;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    color: #333;
  }

  .${BUTTON_CLASS}:hover {
    background-color: #ddd;
  }

  .${BUTTON_TO_CLASS} {
    background-color: #e0f0ff;
    border-color: #a8d4f0;
    color: #1a6fa8;
  }

  .${BUTTON_TO_CLASS}:hover {
    background-color: #cce4f7;
  }

  /* ダークモード */
  body.mainContentArea--dark .${BUTTON_CLASS},
  body[data-theme="dark"] .${BUTTON_CLASS},
  .darkMode .${BUTTON_CLASS} {
    background-color: #3a3a3a;
    border-color: #555;
    color: #ddd;
  }

  body.mainContentArea--dark .${BUTTON_CLASS}:hover,
  body[data-theme="dark"] .${BUTTON_CLASS}:hover,
  .darkMode .${BUTTON_CLASS}:hover {
    background-color: #4a4a4a;
  }

  body.mainContentArea--dark .${BUTTON_TO_CLASS},
  body[data-theme="dark"] .${BUTTON_TO_CLASS},
  .darkMode .${BUTTON_TO_CLASS} {
    background-color: #1a3a50;
    border-color: #2a5a7a;
    color: #8ac4ea;
  }

  body.mainContentArea--dark .${BUTTON_TO_CLASS}:hover,
  body[data-theme="dark"] .${BUTTON_TO_CLASS}:hover,
  .darkMode .${BUTTON_TO_CLASS}:hover {
    background-color: #224a62;
  }

  @media (prefers-color-scheme: dark) {
    body.mainContentArea--dark .${BUTTON_CLASS},
    body[data-theme="dark"] .${BUTTON_CLASS},
    .darkMode .${BUTTON_CLASS} {
      background-color: #3a3a3a;
      border-color: #555;
      color: #ddd;
    }
  }
`;

interface ReactionUser {
  name: string;
  accountId: string | null;
}

function getReactionUsers(reactionList: Element): ReactionUser[] {
  // li.reactionUserListTooltip__item から取得
  const items = reactionList.querySelectorAll(
    "li.reactionUserListTooltip__item",
  );
  return Array.from(items).map((li) => {
    // 名前: .reactionUserListTooltip__userName のテキストから末尾「さん」を除去
    let name =
      li.querySelector(".reactionUserListTooltip__userName")?.textContent?.trim() ?? "";
    name = name.replace(/さん$/, "");

    // accountId: data-cwui-lt-value または img[data-aid]
    const accountId =
      li.getAttribute("data-cwui-lt-value") ??
      li.querySelector("img[data-aid]")?.getAttribute("data-aid") ??
      null;

    return { name, accountId };
  });
}

function copyWithFeedback(btn: HTMLButtonElement, text: string): void {
  const original = btn.textContent;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "コピー済み";
    setTimeout(() => {
      btn.textContent = original;
    }, 1000);
  });
}

function injectButtons(reactionList: Element): void {
  if (reactionList.querySelector(`.${CONTAINER_CLASS}`)) return;

  const container = document.createElement("div");
  container.className = CONTAINER_CLASS;

  // 名前コピーボタン
  const copyBtn = document.createElement("button");
  copyBtn.className = BUTTON_CLASS;
  copyBtn.textContent = "コピー";
  copyBtn.addEventListener("click", () => {
    const users = getReactionUsers(reactionList);
    const text = users
      .map((u) => u.name)
      .filter(Boolean)
      .join("\n");
    copyWithFeedback(copyBtn, text);
  });

  // TO付きコピーボタン
  const toBtn = document.createElement("button");
  toBtn.className = `${BUTTON_CLASS} ${BUTTON_TO_CLASS}`;
  toBtn.textContent = "TO付きコピー";
  toBtn.addEventListener("click", () => {
    const users = getReactionUsers(reactionList);
    const text = users
      .filter((u) => u.name)
      .map((u) =>
        u.accountId ? `[To:${u.accountId}]${u.name}さん` : u.name,
      )
      .join("\n");
    copyWithFeedback(toBtn, text);
  });

  container.appendChild(copyBtn);
  container.appendChild(toBtn);
  reactionList.prepend(container);
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}

export const reactionCopyPlugin: CwPlugin = {
  config: {
    id: "reaction-copy",
    name: "Reaction Copy",
    description: "リアクションしたユーザー一覧をコピー（TO付きも対応）",
  },
  init() {
    injectStyles();
    observer = observeDOM("#_reactionUserList", (el) => {
      injectButtons(el);
    });
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    removeStyles();
    document
      .querySelectorAll(`.${CONTAINER_CLASS}`)
      .forEach((el) => el.remove());
  },
};
