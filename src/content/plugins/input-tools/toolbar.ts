import { wrapSelection, insertAtCursor } from "../../../shared/react-input";
import { EXTENSION_PREFIX } from "../../../shared/constants";

interface ToolButton {
  label: string;
  title: string;
  action: (textarea: HTMLTextAreaElement) => void;
}

const EMOJI_BUTTONS: ToolButton[] = [
  {
    label: "(bow)",
    title: "おじぎ",
    action: (ta) => insertAtCursor(ta, "(bow)"),
  },
  {
    label: "(clap)",
    title: "拍手",
    action: (ta) => insertAtCursor(ta, "(clap)"),
  },
  {
    label: "(roger)",
    title: "了解",
    action: (ta) => insertAtCursor(ta, "(roger)"),
  },
  {
    label: "(congrats)",
    title: "おめでとう",
    action: (ta) => insertAtCursor(ta, "(congrats)"),
  },
  {
    label: "(love)",
    title: "ハート",
    action: (ta) => insertAtCursor(ta, "(love)"),
  },
];

const TAG_BUTTONS: ToolButton[] = [
  {
    label: "[code]",
    title: "コードブロック",
    action: (ta) => wrapSelection(ta, "[code]", "[/code]"),
  },
  {
    label: "[info]",
    title: "情報ボックス",
    action: (ta) => wrapSelection(ta, "[info]", "[/info]"),
  },
  {
    label: "[title]",
    title: "タイトル",
    action: (ta) => wrapSelection(ta, "[info][title]", "[/title][/info]"),
  },
  {
    label: "[hr]",
    title: "水平線",
    action: (ta) => insertAtCursor(ta, "[hr]"),
  },
];

function createButton(
  btn: ToolButton,
  textarea: HTMLTextAreaElement,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.textContent = btn.label;
  el.title = btn.title;
  el.style.cssText = `
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f8f8f8;
    color: #555;
    cursor: pointer;
    white-space: nowrap;
    line-height: 1.4;
    transition: background 0.15s;
  `;
  el.addEventListener("mouseenter", () => {
    el.style.background = "#e8e8e8";
  });
  el.addEventListener("mouseleave", () => {
    el.style.background = "#f8f8f8";
  });
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    textarea.focus();
    btn.action(textarea);
  });
  return el;
}

export function injectToolbar(textarea: HTMLTextAreaElement): void {
  // 既存のツールバーがあればスキップ
  const parent = textarea.closest("#_chatEditor") ?? textarea.parentElement;
  if (!parent) return;
  if (parent.querySelector(`[data-${EXTENSION_PREFIX}-input-tools]`)) return;

  const toolbar = document.createElement("div");
  toolbar.setAttribute(`data-${EXTENSION_PREFIX}-input-tools`, "true");
  toolbar.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 8px;
    border-top: 1px solid #eee;
    background: #fafafa;
  `;

  // タグボタン
  for (const btn of TAG_BUTTONS) {
    toolbar.appendChild(createButton(btn, textarea));
  }

  // セパレータ
  const sep = document.createElement("span");
  sep.style.cssText =
    "width: 1px; background: #ddd; margin: 0 4px; align-self: stretch;";
  toolbar.appendChild(sep);

  // 絵文字ボタン
  for (const btn of EMOJI_BUTTONS) {
    toolbar.appendChild(createButton(btn, textarea));
  }

  // TO全選択ボタン
  const toAllBtn = document.createElement("button");
  toAllBtn.textContent = "TO ALL";
  toAllBtn.title = "全員にTO";
  toAllBtn.style.cssText = `
    padding: 2px 8px;
    font-size: 11px;
    border: 1px solid #4a9eff;
    border-radius: 4px;
    background: #4a9eff;
    color: white;
    cursor: pointer;
    white-space: nowrap;
    line-height: 1.4;
    margin-left: auto;
    transition: background 0.15s;
  `;
  toAllBtn.addEventListener("mouseenter", () => {
    toAllBtn.style.background = "#3a8eef";
  });
  toAllBtn.addEventListener("mouseleave", () => {
    toAllBtn.style.background = "#4a9eff";
  });
  toAllBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectAllTo();
  });
  toolbar.appendChild(toAllBtn);

  parent.appendChild(toolbar);
}

function selectAllTo(): void {
  // TOボタンをクリックしてTOリストを開く
  const toBtn = document.querySelector("#_to") as HTMLElement | null;
  if (toBtn) {
    toBtn.click();
    // リストが開いたらチェックボックスを全選択
    setTimeout(() => {
      const checkboxes = document.querySelectorAll<HTMLInputElement>(
        '#_toList input[type="checkbox"]:not(:checked)',
      );
      checkboxes.forEach((cb) => cb.click());
    }, 200);
  }
}
