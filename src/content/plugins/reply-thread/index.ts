import type { CwPlugin } from "../types";
import { escapeHtml } from "../../../shared/escape-html";
import { getPluginConfig, storageKeyForPlugin } from "../../../shared/storage";

export type ReplyThreadAlignment = "left" | "right";

export interface ReplyThreadConfig {
  alignment?: ReplyThreadAlignment;
  compact?: boolean;
}

const PLUGIN_ID = "reply-thread";
const STYLE_ID = "scw-reply-thread-style";
const BADGE_CLASS = "scw-reply-thread-badge";
const BADGE_LEFT_CLASS = "scw-reply-thread-badge--left";
const POPOVER_CLASS = "scw-reply-thread-popover";
const POPOVER_ID = "scw-reply-thread-popover-root";
const MESSAGE_SELECTOR = "div[id^=_messageId]";
const PREVIEW_LINES = 2;
const PREVIEW_MAX_CHARS = 120;
const SCAN_INTERVAL_MS = 1500;

const STYLES = `
  .${BADGE_CLASS} {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 4px 0 4px auto;
    padding: 2px 8px;
    font-size: 11px;
    line-height: 1.4;
    color: #2d6cdf;
    background: rgba(45, 108, 223, 0.08);
    border: 1px solid rgba(45, 108, 223, 0.25);
    border-radius: 999px;
    cursor: pointer;
    user-select: none;
    width: max-content;
    align-self: flex-end;
    position: relative;
    z-index: 1;
  }
  .${BADGE_CLASS}.${BADGE_LEFT_CLASS} {
    margin-left: 0;
    margin-right: auto;
    align-self: flex-start;
  }
  .${BADGE_CLASS}:hover {
    background: rgba(45, 108, 223, 0.18);
  }
  #${POPOVER_ID} {
    position: absolute;
    z-index: 9999;
    min-width: 240px;
    max-width: 360px;
    max-height: 360px;
    overflow-y: auto;
    background: #fff;
    color: #333;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    font-size: 12px;
    line-height: 1.5;
  }
  .${POPOVER_CLASS}__header {
    padding: 8px 12px;
    font-weight: 600;
    border-bottom: 1px solid #eee;
    background: #f6f8fa;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }
  .${POPOVER_CLASS}__list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .${POPOVER_CLASS}__item {
    padding: 8px 12px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
  }
  .${POPOVER_CLASS}__item:last-child { border-bottom: none; }
  .${POPOVER_CLASS}__item:hover { background: #f6f8fa; }
  .${POPOVER_CLASS}__name {
    font-weight: 600;
    color: #2d6cdf;
    margin-bottom: 2px;
  }
  .${POPOVER_CLASS}__preview {
    color: #555;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .${POPOVER_CLASS}__missing {
    color: #999;
    font-style: italic;
  }
`;

interface ReplyEntry {
  replyMessageId: string;
}

const replyIndex = new Map<string, ReplyEntry[]>();
const badgeByParentId = new Map<string, HTMLElement>();
const indexedAs = new WeakMap<Element, string>();

let mutationObserver: MutationObserver | null = null;
let scanInterval: ReturnType<typeof setInterval> | null = null;
let storageListener:
  | ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void)
  | null = null;
let popoverEl: HTMLDivElement | null = null;
let outsideClickHandler: ((e: Event) => void) | null = null;
let enabled = false;

let currentConfig: Required<ReplyThreadConfig> = {
  alignment: "right",
  compact: false,
};

function getMessageId(el: Element): string {
  const dataMid = el.getAttribute("data-mid");
  if (dataMid) return dataMid;
  const m = (el.id || "").match(/_messageId(\d+)/);
  return m?.[1] ?? "";
}

function extractReplyTargetIds(messageEl: Element): string[] {
  const myId = getMessageId(messageEl);
  const markers = messageEl.querySelectorAll<HTMLElement>(
    "div._replyMessage[data-mid]",
  );
  const targets = new Set<string>();
  for (const marker of Array.from(markers)) {
    const targetMid = marker.getAttribute("data-mid") ?? "";
    if (!targetMid || targetMid === myId) continue;
    targets.add(targetMid);
  }
  return Array.from(targets);
}

function getSpeakerName(el: Element): string {
  const candidates = [
    "[data-testid='timeline_user-name']",
    "[data-testid='speaker-name']",
    ".speakerName",
    ".speaker",
    "[class*='speakerName']",
    "[class*='Speaker']",
  ];
  for (const sel of candidates) {
    const node = el.querySelector<HTMLElement>(sel);
    const text = node?.textContent?.trim();
    if (text) return text;
  }
  const avatar = el.querySelector<HTMLImageElement>(".userIconImage[alt]");
  const alt = avatar?.getAttribute("alt")?.trim();
  if (alt) return alt;
  return "（送信者不明）";
}

/**
 * メッセージ本文のテキストを取得する。
 * `<pre>` には「返信元」ブロック・TOメンション・引用などの構造要素が混じるので、
 * cloneしてそれらを除去してから純粋な本文テキストを取り出す。
 */
function getRenderedBodyText(el: Element): string {
  const pre = el.querySelector<HTMLElement>("pre");
  if (!pre) return "";
  const clone = pre.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-cwtag^="[rp"]').forEach((e) => e.remove());
  clone.querySelectorAll("._replyMessage").forEach((e) => e.remove());
  clone.querySelectorAll('[data-cwtag^="[To"]').forEach((e) => e.remove());
  clone.querySelectorAll(".dev_quote, .chatQuote").forEach((e) => e.remove());
  clone.querySelectorAll(".chatInfo").forEach((e) => e.remove());
  return clone.innerText || clone.textContent || "";
}

function buildPreview(el: Element): string {
  const text = getRenderedBodyText(el);
  if (!text) return "（本文なし）";
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return "（本文なし）";
  const head = lines.slice(0, PREVIEW_LINES).join("\n");
  return head.length > PREVIEW_MAX_CHARS
    ? `${head.slice(0, PREVIEW_MAX_CHARS)}…`
    : head;
}

/**
 * messageId から実メッセージdiv要素を取得する。
 * 落とし穴:
 * - `<a class="_messageLink">` も data-mid を持つ → DIVに限定
 * - `<div class="_replyMessage" data-mid="<親>">` は返信元マーカーで親そのものではない
 *   → `_message` クラス必須で除外
 */
function findMessageElementById(messageId: string): HTMLElement | null {
  const byId = document.getElementById(`_messageId${messageId}`);
  if (byId && byId.tagName === "DIV" && byId.classList.contains("_message")) {
    return byId;
  }
  const midCandidates = document.querySelectorAll<HTMLElement>(
    `[data-mid="${messageId}"]`,
  );
  for (const c of Array.from(midCandidates)) {
    if (c.tagName === "DIV" && c.classList.contains("_message")) return c;
  }
  return null;
}

function badgeCountText(count: number): string {
  return currentConfig.compact ? `${count}` : `返信あり ${count}件`;
}

function applyBadgeAppearance(badge: HTMLElement, count: number): void {
  const countEl = badge.querySelector<HTMLElement>(".scw-reply-thread-count");
  if (countEl) countEl.textContent = badgeCountText(count);
  badge.classList.toggle(BADGE_LEFT_CLASS, currentConfig.alignment === "left");
}

function ensureBadge(parentId: string): void {
  const entries = replyIndex.get(parentId) ?? [];
  const existing = badgeByParentId.get(parentId);

  if (entries.length === 0) {
    existing?.remove();
    badgeByParentId.delete(parentId);
    return;
  }

  const parentEl = findMessageElementById(parentId);
  if (!parentEl) {
    if (existing) {
      existing.remove();
      badgeByParentId.delete(parentId);
    }
    document
      .querySelectorAll<HTMLElement>(`.${BADGE_CLASS}[data-parent-id="${parentId}"]`)
      .forEach((b) => b.remove());
    return;
  }

  const pre = parentEl.querySelector<HTMLElement>("pre");
  const contentWrapper = pre?.parentElement ?? parentEl;

  if (existing && existing.isConnected && parentEl.contains(existing)) {
    applyBadgeAppearance(existing, entries.length);
    if (contentWrapper.lastElementChild !== existing) {
      contentWrapper.appendChild(existing);
    }
    return;
  }

  existing?.remove();

  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.setAttribute("role", "button");
  badge.setAttribute("aria-label", "返信を表示");
  badge.dataset.parentId = parentId;
  badge.innerHTML = `<span aria-hidden="true">💬</span><span class="scw-reply-thread-count"></span>`;
  applyBadgeAppearance(badge, entries.length);

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    togglePopover(badge, parentId);
  });

  contentWrapper.appendChild(badge);
  badgeByParentId.set(parentId, badge);
}

function destroyPopover(): void {
  popoverEl?.remove();
  popoverEl = null;
  if (outsideClickHandler) {
    document.removeEventListener("mousedown", outsideClickHandler, true);
    document.removeEventListener("keydown", outsideClickHandler, true);
    outsideClickHandler = null;
  }
}

function togglePopover(anchor: HTMLElement, parentId: string): void {
  if (popoverEl && popoverEl.dataset.parentId === parentId) {
    destroyPopover();
    return;
  }
  destroyPopover();
  showPopover(anchor, parentId);
}

function showPopover(anchor: HTMLElement, parentId: string): void {
  const entries = replyIndex.get(parentId) ?? [];
  if (entries.length === 0) return;

  const root = document.createElement("div");
  root.id = POPOVER_ID;
  root.dataset.parentId = parentId;

  const header = document.createElement("div");
  header.className = `${POPOVER_CLASS}__header`;
  header.textContent = `返信 ${entries.length}件`;
  root.appendChild(header);

  const list = document.createElement("ul");
  list.className = `${POPOVER_CLASS}__list`;

  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = `${POPOVER_CLASS}__item`;

    const liveEl = findMessageElementById(entry.replyMessageId);
    if (liveEl) {
      const name = getSpeakerName(liveEl);
      const preview = buildPreview(liveEl);
      li.innerHTML = `
        <div class="${POPOVER_CLASS}__name">${escapeHtml(name)}</div>
        <div class="${POPOVER_CLASS}__preview">${escapeHtml(preview)}</div>
      `;
      li.addEventListener("click", () => {
        destroyPopover();
        scrollToMessage(entry.replyMessageId);
      });
    } else {
      li.innerHTML = `<div class="${POPOVER_CLASS}__missing">表示範囲外（読み込まれていません）</div>`;
    }

    list.appendChild(li);
  }

  root.appendChild(list);
  document.body.appendChild(root);

  positionPopover(root, anchor);
  popoverEl = root;

  outsideClickHandler = (e: Event) => {
    if (e.type === "keydown") {
      if ((e as KeyboardEvent).key === "Escape") destroyPopover();
      return;
    }
    const target = e.target as Node | null;
    if (!target) return;
    if (root.contains(target) || anchor.contains(target)) return;
    destroyPopover();
  };
  document.addEventListener("mousedown", outsideClickHandler, true);
  document.addEventListener("keydown", outsideClickHandler, true);
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 4;
  const left = rect.left + window.scrollX;
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;

  const popRect = popover.getBoundingClientRect();
  const overflowRight = popRect.right - window.innerWidth;
  if (overflowRight > 0) {
    popover.style.left = `${left - overflowRight - 8}px`;
  }
}

function scrollToMessage(messageId: string): void {
  const el = findMessageElementById(messageId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  highlightMessage(el);
}

function highlightMessage(el: HTMLElement): void {
  const original = el.style.transition;
  const originalBg = el.style.backgroundColor;
  el.style.transition = "background-color 0.4s ease";
  el.style.backgroundColor = "rgba(255, 235, 59, 0.35)";
  window.setTimeout(() => {
    el.style.backgroundColor = originalBg;
    window.setTimeout(() => {
      el.style.transition = original;
    }, 500);
  }, 800);
}

function indexMessage(messageEl: Element): void {
  if (!enabled) return;

  const replyMessageId = getMessageId(messageEl);
  if (!replyMessageId) return;

  if (indexedAs.get(messageEl) === replyMessageId) return;
  indexedAs.set(messageEl, replyMessageId);

  const parentIds = extractReplyTargetIds(messageEl);
  if (parentIds.length === 0) return;

  for (const parentId of parentIds) {
    const list = replyIndex.get(parentId) ?? [];
    if (!list.some((e) => e.replyMessageId === replyMessageId)) {
      list.push({ replyMessageId });
      replyIndex.set(parentId, list);
    }
    ensureBadge(parentId);
  }
}

function scanAll(): void {
  if (!enabled) return;
  const messages = document.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR);
  for (const m of Array.from(messages)) {
    indexMessage(m);
  }
  for (const parentId of replyIndex.keys()) {
    ensureBadge(parentId);
  }
}

let scanScheduled = false;
function scheduleScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scanAll();
  });
}

function clearAll(): void {
  destroyPopover();
  for (const badge of badgeByParentId.values()) {
    badge.remove();
  }
  badgeByParentId.clear();
  replyIndex.clear();
}

async function loadConfig(): Promise<void> {
  const cfg = (await getPluginConfig<ReplyThreadConfig>(PLUGIN_ID)) ?? {};
  currentConfig = {
    alignment: cfg.alignment ?? "right",
    compact: cfg.compact ?? false,
  };
}

function applyConfigToExistingBadges(): void {
  for (const [parentId, badge] of badgeByParentId.entries()) {
    const entries = replyIndex.get(parentId) ?? [];
    applyBadgeAppearance(badge, entries.length);
  }
}

export const replyThreadPlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "返信スレッド",
    description: "",
  },
  init() {
    enabled = true;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = STYLES;
      document.head.appendChild(style);
    }

    void loadConfig().then(() => {
      applyConfigToExistingBadges();
    });

    // 自分のpluginConfig変更を検知してliveに反映
    const ownStorageKey = storageKeyForPlugin(PLUGIN_ID);
    storageListener = (changes, area) => {
      if (area !== "sync") return;
      if (!changes[ownStorageKey]) return;
      void loadConfig().then(() => {
        applyConfigToExistingBadges();
      });
    };
    chrome.storage.onChanged.addListener(storageListener);

    scanAll();

    mutationObserver = new MutationObserver(() => {
      scheduleScan();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    scanInterval = setInterval(scanAll, SCAN_INTERVAL_MS);
  },
  destroy() {
    enabled = false;
    mutationObserver?.disconnect();
    mutationObserver = null;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (storageListener) {
      chrome.storage.onChanged.removeListener(storageListener);
      storageListener = null;
    }
    document.getElementById(STYLE_ID)?.remove();
    clearAll();
  },
};
