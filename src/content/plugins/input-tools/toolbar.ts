import { wrapSelection, insertAtCursor } from "../../../shared/react-input";

const STYLE_ID = "scw-input-tools-style";
const ICONS_ID = "scw-input-tools-icons";
const ICON_CLASS = "scw-input-tools__icon";
const TAG_CLASS = "scw-input-tools__tag";
const EMO_CLASS = "scw-input-tools__emo";
const ACTION_CLASS = "scw-input-tools__action";

interface ToolButton {
  label: string;
  ariaLabel: string;
  type: "tag" | "emo" | "action";
  action: (textarea: HTMLTextAreaElement) => void;
}

const BUTTONS: ToolButton[] = [
  { label: "code", ariaLabel: "code：選択したメッセージをcodeタグで囲みます", type: "tag", action: (ta) => wrapSelection(ta, "[code]", "[/code]") },
  { label: "info", ariaLabel: "info：選択したメッセージをinfoタグで囲みます", type: "tag", action: (ta) => wrapSelection(ta, "[info]", "[/info]") },
  { label: "title", ariaLabel: "title：選択したメッセージをtitleタグで囲みます", type: "tag", action: (ta) => wrapSelection(ta, "[info][title]", "[/title][/info]") },
  { label: "hr", ariaLabel: "hr：メッセージにhrタグを挿入します", type: "tag", action: (ta) => insertAtCursor(ta, "[hr]") },
  { label: "bow", ariaLabel: "bow：メッセージにおじぎエモーティコンを挿入します", type: "emo", action: (ta) => insertAtCursor(ta, "(bow)") },
  { label: "clap", ariaLabel: "clap：メッセージに拍手エモーティコンを挿入します", type: "emo", action: (ta) => insertAtCursor(ta, "(clap)") },
  { label: "roger", ariaLabel: "roger：メッセージに了解エモーティコンを挿入します", type: "emo", action: (ta) => insertAtCursor(ta, "(roger)") },
  { label: "congrats", ariaLabel: "congrats：メッセージにおめでとうエモーティコンを挿入します", type: "emo", action: (ta) => insertAtCursor(ta, "(congrats)") },
  { label: "love", ariaLabel: "love：メッセージにハートエモーティコンを挿入します", type: "emo", action: (ta) => insertAtCursor(ta, "(love)") },
  { label: "TO ALL", ariaLabel: "TO ALL：全員にTOを付けます", type: "action", action: () => selectAllTo() },
];

const STYLES = `
  #${ICONS_ID} {
    display: flex;
    align-items: center;
  }

  .${ICON_CLASS} {
    align-items: center;
    cursor: pointer;
    display: flex;
    height: 24px;
    opacity: 0.8;
    margin: 0 4px;
  }

  .${ICON_CLASS}:hover {
    opacity: 1;
  }

  .${TAG_CLASS},
  .${EMO_CLASS},
  .${ACTION_CLASS} {
    -webkit-user-select: none;
    user-select: none;
    align-items: center;
    border-radius: 2px;
    color: #ffffff;
    display: flex;
    font-family: -apple-system, BlinkMacSystemFont, ".SFNSDisplay-Regular",
                 "Helvetica Neue", "Hiragino Sans", "ヒラギノ角ゴシック",
                 Meiryo, "メイリオ", sans-serif;
    font-size: 12px;
    line-height: 12px;
    padding: 2px 4px;
  }

  .${TAG_CLASS} {
    background-color: #444444;
  }

  .${EMO_CLASS} {
    background-color: #ffa000;
  }

  .${ACTION_CLASS} {
    background-color: #5c8a8a;
  }
`;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function getChatTextarea(): HTMLTextAreaElement | null {
  return document.querySelector("#_chatText") as HTMLTextAreaElement | null;
}

export function injectToolbar(): void {
  if (document.getElementById(ICONS_ID)) return;

  // 既存拡張と同じ位置: アイコン列<ul>の後ろの兄弟として挿入
  // <ul class="sc-fiCwlc ..."> が絵文字/TO/ファイル等のアイコン列
  const emoticon = document.querySelector("#_emoticon");
  if (!emoticon) return;

  // #_emoticon → button → div → div._showDescription → ul（アイコン列）
  const iconsUl = emoticon.closest("ul");
  if (!iconsUl) return;

  injectStyles();

  const ul = document.createElement("ul");
  ul.id = ICONS_ID;

  for (const btn of BUTTONS) {
    const li = document.createElement("li");
    li.className = `_showDescription ${ICON_CLASS}`;
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", btn.ariaLabel);

    const spanClass = btn.type === "tag" ? TAG_CLASS
      : btn.type === "emo" ? EMO_CLASS
      : ACTION_CLASS;

    const span = document.createElement("span");
    span.className = spanClass;
    span.textContent = btn.label;
    li.appendChild(span);

    li.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ta = getChatTextarea();
      if (ta) {
        ta.focus();
        btn.action(ta);
      }
    });

    ul.appendChild(li);
  }

  // アイコン列<ul>の後ろに兄弟要素として挿入
  iconsUl.insertAdjacentElement("afterend", ul);
}

function selectAllTo(): void {
  const toBtn = document.querySelector("#_to") as HTMLElement | null;
  if (toBtn) {
    toBtn.click();
    setTimeout(() => {
      const checkboxes = document.querySelectorAll<HTMLInputElement>(
        '#_toList input[type="checkbox"]:not(:checked)',
      );
      checkboxes.forEach((cb) => cb.click());
    }, 200);
  }
}

export function removeToolbar(): void {
  document.getElementById(ICONS_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}
