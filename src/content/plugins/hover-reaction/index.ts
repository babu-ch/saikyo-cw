import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { sleep } from "../../../shared/dom-helpers";
import { getPluginConfig } from "../../../shared/storage";
import { ALL_REACTIONS } from "../../../shared/reactions";

export type HoverReactionAlign = "right" | "left";

const PLUGIN_ID = "hover-reaction";
const ACTION_NAV_SELECTOR = "ul.messageActionNav";
const ROW_CLASS = "scw-hover-reaction-row";
const BTN_CLASS = "scw-hover-reaction-row__btn";
const STYLE_ID = "scw-hover-reaction-style";
const MARKER = "__scw_hover_reaction";
const EMOTICON_BASE = "https://assets.chatwork.com/images/emoticon2x/";

interface HoverReactionConfig {
  alignment?: HoverReactionAlign;
}

let observer: MutationObserver | null = null;
let enabled = false;

const STYLES = `
  .${ROW_CLASS} {
    position: absolute;
    top: 100%;
    display: inline-flex;
    width: max-content;
    max-width: 100%;
    gap: 2px;
    padding: 2px 6px;
    margin: 0;
    list-style: none;
    background-color: transparent;
    border-top: 1px solid rgba(127, 127, 127, 0.2);
  }
  .${ROW_CLASS} li { list-style: none; margin: 0; padding: 0; }
  .${BTN_CLASS} {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    line-height: 0;
    color: inherit;
  }
  .${BTN_CLASS}:hover {
    background-color: rgba(127, 127, 127, 0.18);
    border-color: rgba(127, 127, 127, 0.35);
  }
  .${BTN_CLASS} img {
    width: 20px;
    height: 20px;
    display: block;
  }
`;

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

function findReactionNavButton(actionNav: Element): HTMLElement | null {
  const buttons = actionNav.querySelectorAll<HTMLElement>("li button");
  for (const btn of buttons) {
    const label = btn.querySelector(".actionLabel")?.textContent?.trim();
    if (label === "リアクション") return btn;
  }
  return null;
}

async function sendReaction(actionNav: Element, label: string): Promise<void> {
  const navBtn = findReactionNavButton(actionNav);
  if (!navBtn) return;
  navBtn.click();

  // reaction-list (popup) が表示されるのを最大400ms待つ
  for (let i = 0; i < 20; i++) {
    const list = document.querySelector('[data-testid="reaction-list"]');
    if (list) {
      const target = list.querySelector<HTMLElement>(
        `button[aria-label="${label}"]`,
      );
      target?.click();
      return;
    }
    await sleep(20);
  }
}

function buildRow(actionNav: Element, align: HoverReactionAlign): HTMLElement {
  const row = document.createElement("ul");
  row.className = ROW_CLASS;
  row.setAttribute("role", "toolbar");
  if (align === "left") {
    row.style.left = "0";
  } else {
    row.style.right = "0";
  }

  for (const r of ALL_REACTIONS) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BTN_CLASS;
    btn.setAttribute("aria-label", r.label);
    btn.title = r.label;
    const img = document.createElement("img");
    img.src = `${EMOTICON_BASE}${r.emoticon}`;
    img.alt = r.describe;
    btn.appendChild(img);
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      sendReaction(actionNav, r.label);
    });
    li.appendChild(btn);
    row.appendChild(li);
  }
  return row;
}

async function injectRow(actionNav: Element): Promise<void> {
  if (!enabled) return;
  const rec = actionNav as unknown as Record<string, unknown>;
  if (rec[MARKER]) return;
  rec[MARKER] = true;

  const config = (await getPluginConfig<HoverReactionConfig>(PLUGIN_ID)) ?? {};
  const align: HoverReactionAlign = config.alignment ?? "right";
  if (!enabled || !actionNav.isConnected) return;
  actionNav.insertAdjacentElement("afterend", buildRow(actionNav, align));
}

export const hoverReactionPlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "ホバーリアクション",
    description: "ホバーメニューの下にリアクション絵文字をワンクリック送信できるボタンを表示",
  },
  init() {
    enabled = true;
    injectStyles();
    observer = observeDOM(ACTION_NAV_SELECTOR, (el) => {
      injectRow(el);
    });
  },
  destroy() {
    enabled = false;
    observer?.disconnect();
    observer = null;
    removeStyles();
    document.querySelectorAll(`.${ROW_CLASS}`).forEach((el) => el.remove());
  },
};
