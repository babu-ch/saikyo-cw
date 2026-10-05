import type { CwPlugin } from "../types";
import { CW } from "../../../shared/chatwork-selectors";
import { observeActionNavs } from "../../../shared/mutation-observer";
import { waitFor } from "../../../shared/dom-helpers";
import { hideUntilClosed } from "../../../shared/cw-popups";
import {
  getPluginConfig,
  storageKeyForPlugin,
  type PluginSettings,
} from "../../../shared/storage";
import { EMOTICON_BASE, resolveReactions, type Reaction } from "../../../shared/reactions";

export type HoverReactionAlign = "right" | "left";
/** below=メニューの下の段（従来）、inline=純正の「リアクション」の位置 */
export type HoverReactionDisplay = "below" | "inline";

const PLUGIN_ID = "hover-reaction";
// メニューの下の段（従来）
const ROW_CLASS = "scw-hover-reaction-row";
const ROW_BTN_CLASS = "scw-hover-reaction-row__btn";
const ROW_ICON_SIZE = 20;
// 純正の「リアクション」の位置
const BTN_CLASS = "scw-hover-reaction__btn";
const ACTIVE_CLASS = "scw-hover-reaction__btn--active";
const EMOTICON_ATTR = "data-scw-emoticon";
const ICON_SIZE = 18;
const STYLE_ID = "scw-hover-reaction-style";
const QUICK_LIST = '[data-testid="reaction-list"]';

export interface HoverReactionConfig {
  /** 未設定なら従来どおりメニューの下の段 */
  display?: HoverReactionDisplay;
  /** メニューの下の段の寄せ */
  alignment?: HoverReactionAlign;
  /** 並べるリアクション（emoticonのファイル名）。未設定ならDEFAULT_REACTIONS（従来の6種） */
  reactions?: string[];
  stopAnimation?: boolean;
}

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

let observer: MutationObserver | null = null;
let badgeObserver: MutationObserver | null = null;
let onStorageChanged: StorageListener | null = null;
let enabled = false;
// 設定の読み込み中にdestroy→initされたとき、古い読み込み結果を捨てるための世代
let generation = 0;
let config: HoverReactionConfig = {};

const ROW_STYLES = `
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
  .${ROW_BTN_CLASS} {
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
  .${ROW_BTN_CLASS}:hover {
    background-color: rgba(127, 127, 127, 0.18);
    border-color: rgba(127, 127, 127, 0.35);
  }
  .${ROW_BTN_CLASS} canvas,
  .${ROW_BTN_CLASS} img {
    width: ${ROW_ICON_SIZE}px;
    height: ${ROW_ICON_SIZE}px;
    display: block;
  }
`;

// 純正の「リアクション」はアイコンだけにして「もっと見る」として使う
const INLINE_STYLES = `
  ${CW.MESSAGE_ACTION_NAV} > li:not([class*="scw-"]):has(use[href="#icon_reaction"]) .actionLabel {
    display: none;
  }
  /* 純正ボタンの左右8pxの余白のままだと間延びするので詰める */
  .${BTN_CLASS} button {
    padding-left: 3px;
    padding-right: 3px;
  }
  .${BTN_CLASS} .iconContainer {
    width: auto;
    height: auto;
  }
  .${BTN_CLASS} img,
  .${BTN_CLASS} canvas {
    width: ${ICON_SIZE}px;
    height: ${ICON_SIZE}px;
    display: block;
  }
  /* 自分が押しているリアクション。メッセージ下の自分のリアクションと同じ色にする */
  .${ACTIVE_CLASS} button {
    background-color: rgba(204, 223, 245, 0.5);
    box-shadow: inset 0 0 0 1px rgb(46, 81, 144);
    border-radius: 4px;
  }
`;

function displayOf(c: HoverReactionConfig): HoverReactionDisplay {
  return c.display === "inline" ? "inline" : "below";
}

function applyStyles(css: string | null): void {
  let style = document.getElementById(STYLE_ID);
  if (css === null) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

function findReactionLi(actionNav: Element): HTMLElement | null {
  return (
    actionNav
      .querySelector(':scope > li:not([class*="scw-"]) use[href="#icon_reaction"]')
      ?.closest("li") ?? null
  );
}

// 小窓の6種はボタン名（aria-label）で、それ以外はemoticonの画像で押すボタンを見分ける
function findReactionButton(list: Element, r: Reaction): HTMLElement | null {
  if (r.label) {
    const byLabel = list.querySelector<HTMLElement>(`button[aria-label="${r.label}"]`);
    if (byLabel) return byLabel;
  }
  return (
    list.querySelector(`img[src$="/${r.emoticon}"]`)?.closest("li")?.querySelector("button") ??
    null
  );
}

function findBadge(message: Element, emoticon: string): HTMLElement | null {
  return (
    message
      .querySelector(`${CW.REACTION_BADGE} img[src$="/${emoticon}"]`)
      ?.closest<HTMLElement>(CW.REACTION_BADGE) ?? null
  );
}

// メッセージ下の自分のリアクションに合わせて、並べたボタンの押している状態を付け替える
function updateButtonStates(message: Element): void {
  for (const li of message.querySelectorAll<HTMLElement>(`.${BTN_CLASS}`)) {
    const emoticon = li.getAttribute(EMOTICON_ATTR) ?? "";
    const active = findBadge(message, emoticon)?.matches(CW.MY_REACTION_BADGE) ?? false;
    li.classList.toggle(ACTIVE_CLASS, active);
    li.querySelector("button")?.setAttribute("aria-pressed", String(active));
  }
}

function containsBadge(node: Node): boolean {
  return (
    node instanceof Element &&
    (node.matches(CW.REACTION_BADGE) || node.querySelector(CW.REACTION_BADGE) !== null)
  );
}

// リアクションは純正の小窓やメッセージ下からも付け外しされるので、バッジの変化を見て追従する
function observeBadges(): MutationObserver {
  const mo = new MutationObserver((mutations) => {
    const messages = new Set<Element>();
    for (const m of mutations) {
      const changed =
        m.type === "attributes"
          ? (m.target as Element).matches(CW.REACTION_BADGE)
          : [...m.addedNodes, ...m.removedNodes].some(containsBadge);
      const message = changed ? (m.target as Element).closest(CW.MESSAGE) : null;
      if (message) messages.add(message);
    }
    messages.forEach(updateButtonStates);
  });
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label"],
  });
  return mo;
}

function findQuickList(): Element | null {
  return document.querySelector(QUICK_LIST);
}

// 「すべてのリアクション」一覧にはtestidがないので、画像付きボタンが大量に並ぶulで見分ける
function findAllList(): Element | null {
  for (const ul of document.querySelectorAll("ul")) {
    if (ul.closest(CW.MESSAGE) || ul.closest(CW.MESSAGE_ACTION_NAV)) continue;
    if (ul.querySelectorAll(":scope > li > button > img").length >= 20) return ul;
  }
  return null;
}

function findAllButton(quickList: Element): HTMLElement | null {
  return quickList.querySelector('use[href="#icon_more"]')?.closest("button") ?? null;
}

// 純正の「リアクション」から小窓（なければ「すべてのリアクション」）を開いて押す
async function sendViaPicker(actionNav: Element, r: Reaction): Promise<void> {
  const navBtn = findReactionLi(actionNav)?.querySelector("button");
  if (!navBtn) return;
  navBtn.click();

  const quickList = await waitFor(findQuickList);
  if (!quickList) return;

  const quickTarget = findReactionButton(quickList, r);
  if (quickTarget) {
    hideUntilClosed(quickList);
    quickTarget.click();
    return;
  }

  const allBtn = findAllButton(quickList);
  if (!allBtn) return;
  hideUntilClosed(quickList);
  allBtn.click();

  const allList = await waitFor(findAllList);
  const target = allList ? findReactionButton(allList, r) : null;
  // 見つからなければ一覧を見せたままにして、手で選べるようにする
  if (!allList || !target) return;
  hideUntilClosed(allList);
  target.click();
}

async function toggleReaction(actionNav: Element, r: Reaction): Promise<void> {
  // メッセージ下に同じリアクションがあればそれを押す（自分のなら取り消し、他の人のなら同じリアクション）
  const badge = findBadge(actionNav.closest(CW.MESSAGE) ?? actionNav, r.emoticon);
  if (badge) {
    badge.click();
    return;
  }
  await sendViaPicker(actionNav, r);
}

// よく使うものは並んでいるので、純正のアイコンを押したら小窓を飛ばして全種類の一覧を開く
async function openAllReactions(e: Event): Promise<void> {
  // sendViaPicker が押すとき（isTrusted=false）は対象外
  if (!e.isTrusted) return;
  const quickList = await waitFor(findQuickList);
  if (!quickList) return;
  const allBtn = findAllButton(quickList);
  if (!allBtn) return;
  hideUntilClosed(quickList);
  allBtn.click();
}

function onNativeReactionClick(e: Event): void {
  void openAllReactions(e);
}

function buildIcon(r: Reaction, stopAnimation: boolean, size: number): HTMLElement {
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
  canvas.width = size;
  canvas.height = size;
  canvas.setAttribute("aria-label", r.describe);

  const img = new Image();
  img.src = src;
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(img, 0, 0, size, size);
  };
  img.onerror = () => {
    const fallback = document.createElement("img");
    fallback.src = src;
    fallback.alt = r.describe;
    canvas.replaceWith(fallback);
  };
  return canvas;
}

function buildRow(actionNav: Element, reactions: Reaction[]): HTMLElement {
  const row = document.createElement("ul");
  row.className = ROW_CLASS;
  row.setAttribute("role", "toolbar");
  if (config.alignment === "left") {
    row.style.left = "0";
  } else {
    row.style.right = "0";
  }

  for (const r of reactions) {
    const name = r.label ?? r.describe;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = ROW_BTN_CLASS;
    btn.setAttribute("aria-label", name);
    btn.title = name;
    btn.appendChild(buildIcon(r, config.stopAnimation ?? false, ROW_ICON_SIZE));
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      void sendViaPicker(actionNav, r);
    });
    li.appendChild(btn);
    row.appendChild(li);
  }
  return row;
}

// 純正の「リアクション」をcloneして、アイコンを絵文字に差し替える
function buildButton(reactionLi: HTMLElement, actionNav: Element, r: Reaction): HTMLElement {
  const li = reactionLi.cloneNode(true) as HTMLElement;
  li.classList.add(BTN_CLASS);
  li.setAttribute(EMOTICON_ATTR, r.emoticon);
  li.querySelector(".actionLabel")?.remove();

  const icon = buildIcon(r, config.stopAnimation ?? false, ICON_SIZE);
  const btn = li.querySelector("button");
  const iconContainer = li.querySelector(".iconContainer");
  if (iconContainer) {
    iconContainer.replaceChildren(icon);
  } else {
    btn?.replaceChildren(icon);
  }
  btn?.setAttribute("aria-label", r.describe);
  btn?.setAttribute("title", r.describe);

  li.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    void toggleReaction(actionNav, r);
  });
  return li;
}

function injectRow(actionNav: Element): void {
  if (actionNav.nextElementSibling?.classList.contains(ROW_CLASS)) return;
  const reactions = resolveReactions(config.reactions);
  if (reactions.length === 0) return;
  actionNav.insertAdjacentElement("afterend", buildRow(actionNav, reactions));
}

function injectInline(actionNav: Element): void {
  if (actionNav.querySelector(`.${BTN_CLASS}`)) return;
  const reactionLi = findReactionLi(actionNav);
  if (!reactionLi) return;
  const reactions = resolveReactions(config.reactions);
  if (reactions.length === 0) return;

  for (const r of reactions) {
    reactionLi.insertAdjacentElement("beforebegin", buildButton(reactionLi, actionNav, r));
  }
  // 同じ関数なので何度addしても1回だけ
  reactionLi.querySelector("button")?.addEventListener("click", onNativeReactionClick);
  updateButtonStates(actionNav.closest(CW.MESSAGE) ?? actionNav);
}

export function injectReactionButtons(actionNav: Element): void {
  if (!enabled) return;
  if (displayOf(config) === "inline") {
    injectInline(actionNav);
  } else {
    injectRow(actionNav);
  }
}

function removeReactionButtons(): void {
  document.querySelectorAll(`.${ROW_CLASS}, .${BTN_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(CW.MESSAGE_ACTION_NAV).forEach((nav) => {
    findReactionLi(nav)?.querySelector("button")?.removeEventListener("click", onNativeReactionClick);
  });
}

function applyConfig(next: HoverReactionConfig): void {
  config = next;
  removeReactionButtons();
  badgeObserver?.disconnect();
  badgeObserver = null;

  const hasReactions = resolveReactions(config.reactions).length > 0;
  if (displayOf(config) === "inline") {
    // 並べるものがなければ純正の「リアクション」も元のまま
    applyStyles(hasReactions ? INLINE_STYLES : null);
    if (hasReactions) badgeObserver = observeBadges();
  } else {
    applyStyles(ROW_STYLES);
  }
  document.querySelectorAll(CW.MESSAGE_ACTION_NAV).forEach(injectReactionButtons);
}

export const hoverReactionPlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "ホバーリアクション",
    description: "よく使うリアクションをアクションメニューに並べて、ワンクリックで送る",
    defaultEnabled: true,
  },
  init() {
    enabled = true;
    const current = ++generation;
    void getPluginConfig<HoverReactionConfig>(PLUGIN_ID).then((loaded) => {
      if (!enabled || current !== generation) return;
      applyConfig(loaded ?? {});
      observer = observeActionNavs(injectReactionButtons);
    });

    onStorageChanged = (changes, area) => {
      if (!enabled || area !== "sync") return;
      const change = changes[storageKeyForPlugin(PLUGIN_ID)];
      if (!change) return;
      const next = (change.newValue as PluginSettings | undefined)?.config as
        | HoverReactionConfig
        | undefined;
      applyConfig(next ?? {});
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
  },
  destroy() {
    enabled = false;
    generation++;
    observer?.disconnect();
    observer = null;
    badgeObserver?.disconnect();
    badgeObserver = null;
    if (onStorageChanged) {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      onStorageChanged = null;
    }
    removeReactionButtons();
    applyStyles(null);
  },
};
