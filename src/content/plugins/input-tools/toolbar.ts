import { getPluginConfig } from "../../../shared/storage";
import { ALL_BUTTON_METAS, getDefaultEnabledIds } from "../../../shared/input-tools-buttons";
import { getAction } from "./buttons";

const STYLE_ID = "scw-input-tools-style";
const ICONS_ID = "scw-input-tools-icons";
const ICON_CLASS = "scw-input-tools__icon";
const TAG_CLASS = "scw-input-tools__tag";
const EMO_CLASS = "scw-input-tools__emo";
const ACTION_CLASS = "scw-input-tools__action";

interface InputToolsConfig {
  enabledButtons?: string[];
}

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

  .${TAG_CLASS} { background-color: #444444; }
  .${EMO_CLASS} { background-color: #ffa000; }
  .${ACTION_CLASS} { background-color: #5c8a8a; }
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

export async function injectToolbar(): Promise<void> {
  if (document.getElementById(ICONS_ID)) return;

  const emoticon = document.querySelector("#_emoticon");
  if (!emoticon) return;
  const iconsUl = emoticon.closest("ul");
  if (!iconsUl) return;

  const config = await getPluginConfig<InputToolsConfig>("input-tools");
  const enabledIds = config?.enabledButtons ?? getDefaultEnabledIds();
  const enabledSet = new Set(enabledIds);

  const buttons = ALL_BUTTON_METAS.filter((b) => enabledSet.has(b.id));
  if (buttons.length === 0) return;

  injectStyles();

  const ul = document.createElement("ul");
  ul.id = ICONS_ID;

  for (const meta of buttons) {
    const action = getAction(meta.id);
    if (!action) continue;

    const li = document.createElement("li");
    li.className = `_showDescription ${ICON_CLASS}`;
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", meta.description);

    const spanClass = meta.type === "tag" ? TAG_CLASS
      : meta.type === "emo" ? EMO_CLASS
      : ACTION_CLASS;

    const span = document.createElement("span");
    span.className = spanClass;
    span.textContent = meta.label;
    li.appendChild(span);

    li.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const ta = getChatTextarea();
      if (ta) {
        ta.focus();
        action(ta);
      }
    });

    ul.appendChild(li);
  }

  iconsUl.insertAdjacentElement("afterend", ul);
}

export function removeToolbar(): void {
  document.getElementById(ICONS_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}
