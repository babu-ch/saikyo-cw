import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { sleep } from "../../../shared/dom-helpers";
import { getPluginConfig } from "../../../shared/storage";
import { ALL_REACTIONS, type QuickReaction } from "../../../shared/reactions";

export type HoverReactionAlign = "right" | "left";

const PLUGIN_ID = "hover-reaction";
const ACTION_NAV_SELECTOR = "ul.messageActionNav";
const ROW_CLASS = "scw-hover-reaction-row";
const BTN_CLASS = "scw-hover-reaction-row__btn";
const STYLE_ID = "scw-hover-reaction-style";
const MARKER = "__scw_hover_reaction";
const EMOTICON_BASE = "https://assets.chatwork.com/images/emoticon2x/";
const ICON_SIZE = 20;

interface HoverReactionConfig {
  alignment?: HoverReactionAlign;
  stopAnimation?: boolean;
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
  .${BTN_CLASS} canvas,
  .${BTN_CLASS} img {
    width: ${ICON_SIZE}px;
    height: ${ICON_SIZE}px;
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

function buildIcon(r: QuickReaction, stopAnimation: boolean): HTMLElement {
  const src = `${EMOTICON_BASE}${r.emoticon}`;

  if (!stopAnimation) {
    // 素のgifアニメをそのまま表示
    const img = document.createElement("img");
    img.src = src;
    img.alt = r.describe;
    return img;
  }

  // gifを<canvas>に描画して静止画化（ループが止まる）
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  canvas.setAttribute("aria-label", r.describe);

  const img = new Image();
  img.src = src;
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0, ICON_SIZE, ICON_SIZE);
  };
  img.onerror = () => {
    const fallback = document.createElement("img");
    fallback.src = src;
    fallback.alt = r.describe;
    canvas.replaceWith(fallback);
  };
  return canvas;
}

function buildRow(
  actionNav: Element,
  align: HoverReactionAlign,
  stopAnimation: boolean,
): HTMLElement {
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
    btn.appendChild(buildIcon(r, stopAnimation));
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
  const stopAnimation = config.stopAnimation ?? false;
  if (!enabled || !actionNav.isConnected) return;

  actionNav.insertAdjacentElement(
    "afterend",
    buildRow(actionNav, align, stopAnimation),
  );
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
