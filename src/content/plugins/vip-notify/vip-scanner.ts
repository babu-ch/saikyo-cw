import { getApiToken, getPluginConfig } from "../../../shared/storage";

const SCAN_INTERVAL_MS = 60_000;
const STYLE_ID = "scw-vip-notify-style";
const VIP_BADGE_CLASS = "scw-vip-badge";
const VIP_ROOM_ATTR = "data-scw-vip";

// ルームのDOM要素セレクタ
const ROOM_ITEM_SELECTOR = '[role="listitem"][data-rid]';
const UNREAD_BADGE_SELECTOR =
  '.sc-dnqmqq, [class*="unreadBadge"], .roomListItem__unreadBadge, [data-testid="unread-badge"]';

export interface VipEntry {
  accountId: number;
  name: string;
  color: string;
}

interface RoomTypeEntry {
  room_id: number;
  type: "my" | "direct" | "group";
}

let scanTimer: ReturnType<typeof setInterval> | null = null;
let scanning = false;

// 前回の未読数（DOM走査ベースの差分検知用）
const prevUnread = new Map<string, number>();
// ルームタイプキャッシュ（API取得）
let roomTypeMap = new Map<string, string>();
let roomTypeLoaded = false;

const STYLES = `
  .${VIP_BADGE_CLASS} {
    background-color: var(--scw-vip-color, #f44336) !important;
    transition: background-color 0.3s ease;
  }

  [${VIP_ROOM_ATTR}='true'] {
    position: relative;
  }

  [${VIP_ROOM_ATTR}='true']::after {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background-color: var(--scw-vip-color, #f44336);
    border-radius: 0 2px 2px 0;
  }
`;

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

async function loadRoomTypes(token: string): Promise<void> {
  if (roomTypeLoaded) return;

  const res = await chrome.runtime.sendMessage({ type: "fetchRooms", token });
  if (!res?.ok || !Array.isArray(res.rooms)) return;

  roomTypeMap = new Map<string, string>();
  for (const room of res.rooms as RoomTypeEntry[]) {
    roomTypeMap.set(String(room.room_id), room.type);
  }
  roomTypeLoaded = true;
}

async function getVipList(): Promise<VipEntry[]> {
  const config = await getPluginConfig<{ vips?: VipEntry[] }>("vip-notify");
  return config?.vips ?? [];
}

async function scan(): Promise<void> {
  if (scanning) return;
  scanning = true;

  try {
    const token = await getApiToken();
    if (!token) return;

    const vips = await getVipList();
    if (vips.length === 0) {
      clearAllVipBadges();
      return;
    }

    // 初回にルームタイプを取得
    await loadRoomTypes(token);

    const roomItems = document.querySelectorAll<HTMLElement>(ROOM_ITEM_SELECTOR);
    const vipIds = new Set(vips.map((v) => v.accountId));

    // チェック対象を抽出
    const targets: { roomId: string; item: HTMLElement; unreadCount: number }[] = [];

    for (const item of roomItems) {
      const roomId = item.getAttribute("data-rid");
      if (!roomId) continue;

      // マイチャット・DMを除外
      const roomType = roomTypeMap.get(roomId);
      if (roomType === "my" || roomType === "direct") {
        removeVipBadge(item);
        continue;
      }

      const badgeEl = item.querySelector(UNREAD_BADGE_SELECTOR);
      if (!badgeEl) {
        removeVipBadge(item);
        prevUnread.set(roomId, 0);
        continue;
      }

      const unreadCount = parseInt(badgeEl.textContent?.trim() ?? "0", 10);
      if (!unreadCount || unreadCount <= 0) {
        removeVipBadge(item);
        prevUnread.set(roomId, 0);
        continue;
      }

      const prev = prevUnread.get(roomId);
      prevUnread.set(roomId, unreadCount);

      if (prev === undefined || unreadCount > prev) {
        // 新規出現 or 未読増加 → チェック対象
        targets.push({ roomId, item, unreadCount });
      }
      // 変化なしのルームはバッジ状態をそのまま維持
    }

    // 対象ルームのメッセージを取得してVIP判定（直列でAPI負荷を抑える）
    for (const { roomId, item } of targets) {
      try {
        const res = await chrome.runtime.sendMessage({
          type: "fetchMessages",
          roomId,
          token,
        });

        if (!res?.ok || !Array.isArray(res.messages)) {
          continue;
        }

        // メッセージの送信者にVIPがいるか判定
        const hit = findVipHit(res.messages, vipIds, vips);
        if (hit) {
          applyVipBadge(item, hit.color);
        } else {
          removeVipBadge(item);
        }
      } catch {
        // API失敗は無視して次へ
      }
    }
  } finally {
    scanning = false;
  }
}

function findVipHit(
  messages: Array<{ account?: { account_id?: number } }>,
  vipIds: Set<number>,
  vips: VipEntry[],
): VipEntry | null {
  for (const msg of messages) {
    const senderId = msg?.account?.account_id;
    if (senderId != null && vipIds.has(senderId)) {
      return vips.find((v) => v.accountId === senderId) ?? null;
    }
  }
  return null;
}

function applyVipBadge(roomItem: HTMLElement, color: string): void {
  const badgeEl = roomItem.querySelector<HTMLElement>(UNREAD_BADGE_SELECTOR);
  if (badgeEl) {
    badgeEl.classList.add(VIP_BADGE_CLASS);
    badgeEl.style.setProperty("--scw-vip-color", color);
  }
  roomItem.setAttribute(VIP_ROOM_ATTR, "true");
  roomItem.style.setProperty("--scw-vip-color", color);
}

function removeVipBadge(roomItem: HTMLElement): void {
  roomItem.removeAttribute(VIP_ROOM_ATTR);
  roomItem.style.removeProperty("--scw-vip-color");
  const badge = roomItem.querySelector(`.${VIP_BADGE_CLASS}`);
  if (badge) {
    badge.classList.remove(VIP_BADGE_CLASS);
    (badge as HTMLElement).style.removeProperty("--scw-vip-color");
  }
}

function clearAllVipBadges(): void {
  document.querySelectorAll(`.${VIP_BADGE_CLASS}`).forEach((el) => {
    el.classList.remove(VIP_BADGE_CLASS);
    (el as HTMLElement).style.removeProperty("--scw-vip-color");
  });
  document.querySelectorAll(`[${VIP_ROOM_ATTR}]`).forEach((el) => {
    el.removeAttribute(VIP_ROOM_ATTR);
    (el as HTMLElement).style.removeProperty("--scw-vip-color");
  });
}

export function initVipNotify(): void {
  injectStyles();
  // 初回スキャン
  scan();
  scanTimer = setInterval(scan, SCAN_INTERVAL_MS);
}

export function destroyVipNotify(): void {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  scanning = false;
  prevUnread.clear();
  roomTypeLoaded = false;
  roomTypeMap.clear();
  clearAllVipBadges();
  document.getElementById(STYLE_ID)?.remove();
}
