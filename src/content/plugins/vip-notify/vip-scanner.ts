import { getApiToken, getPluginConfig } from "../../../shared/storage";

const SCAN_INTERVAL_MS = 15_000;
const STYLE_ID = "scw-vip-notify-style";
const VIP_BADGE_CLASS = "scw-vip-badge";
const VIP_ROOM_ATTR = "data-scw-vip";
const LOG_PREFIX = "[scw:vip]";

// ルームのDOM要素セレクタ
const ROOM_ITEM_SELECTOR = '[role="tab"][data-rid]';
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

  console.log(LOG_PREFIX, "ルームタイプ取得中...");
  const res = await chrome.runtime.sendMessage({ type: "fetchRooms", token });
  if (!res?.ok || !Array.isArray(res.rooms)) {
    console.warn(LOG_PREFIX, "ルーム取得失敗:", res);
    return;
  }

  roomTypeMap = new Map<string, string>();
  for (const room of res.rooms as RoomTypeEntry[]) {
    roomTypeMap.set(String(room.room_id), room.type);
  }
  roomTypeLoaded = true;
  console.log(LOG_PREFIX, `ルームタイプ取得完了: ${roomTypeMap.size}件 (my=${[...roomTypeMap.values()].filter(t => t === "my").length}, direct=${[...roomTypeMap.values()].filter(t => t === "direct").length}, group=${[...roomTypeMap.values()].filter(t => t === "group").length})`);
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
    if (!token) {
      console.warn(LOG_PREFIX, "APIトークン未設定");
      return;
    }

    const vips = await getVipList();
    if (vips.length === 0) {
      console.log(LOG_PREFIX, "VIPリスト空 → スキップ");
      clearAllVipBadges();
      return;
    }
    console.log(LOG_PREFIX, `VIPリスト: ${vips.map(v => `${v.name}(${v.accountId})`).join(", ")}`);

    // 初回にルームタイプを取得
    await loadRoomTypes(token);

    const roomItems = document.querySelectorAll<HTMLElement>(ROOM_ITEM_SELECTOR);
    console.log(LOG_PREFIX, `DOM上のルーム: ${roomItems.length}件`);

    const vipIds = new Set(vips.map((v) => v.accountId));

    // チェック対象を抽出
    const targets: { roomId: string; item: HTMLElement; unreadCount: number }[] = [];
    let skippedMy = 0;
    let skippedDirect = 0;
    let skippedNoBadge = 0;
    let skippedNoChange = 0;
    let skippedUnknownType = 0;

    for (const item of roomItems) {
      const roomId = item.getAttribute("data-rid");
      if (!roomId) continue;

      // マイチャット・DMを除外
      const roomType = roomTypeMap.get(roomId);
      if (roomType === "my") {
        removeVipBadge(item);
        skippedMy++;
        continue;
      }
      if (roomType === "direct") {
        removeVipBadge(item);
        skippedDirect++;
        continue;
      }
      if (!roomType) {
        skippedUnknownType++;
        // ルームタイプ不明でも処理は続行
      }

      const badgeEl = item.querySelector(UNREAD_BADGE_SELECTOR);
      if (!badgeEl) {
        removeVipBadge(item);
        prevUnread.set(roomId, 0);
        skippedNoBadge++;
        continue;
      }

      const unreadCount = parseInt(badgeEl.textContent?.trim() ?? "0", 10);
      if (!unreadCount || unreadCount <= 0) {
        removeVipBadge(item);
        prevUnread.set(roomId, 0);
        skippedNoBadge++;
        continue;
      }

      const prev = prevUnread.get(roomId);

      if (prev === undefined || unreadCount > prev) {
        // 新規出現 or 未読増加 → チェック対象（prevUnreadはAPI成功後に更新）
        targets.push({ roomId, item, unreadCount });
        console.log(LOG_PREFIX, `  対象: roomId=${roomId}, 未読=${unreadCount} (前回=${prev ?? "なし"})`);
      } else {
        skippedNoChange++;
      }
    }

    console.log(LOG_PREFIX, `スキャン結果: 対象=${targets.length}, スキップ(my=${skippedMy}, dm=${skippedDirect}, バッジなし=${skippedNoBadge}, 変化なし=${skippedNoChange}, タイプ不明=${skippedUnknownType})`);

    // 対象ルームのメッセージを取得してVIP判定（直列でAPI負荷を抑える）
    for (const { roomId, item, unreadCount } of targets) {
      try {
        console.log(LOG_PREFIX, `  fetchMessages: roomId=${roomId}`);
        const res = await chrome.runtime.sendMessage({
          type: "fetchMessages",
          roomId,
          token,
        });

        if (!res?.ok || !Array.isArray(res.messages)) {
          console.warn(LOG_PREFIX, `  fetchMessages失敗: roomId=${roomId}`, res);
          // 失敗時はprevUnreadを更新しない → 次回リトライ
          continue;
        }

        // API成功 → prevUnreadを更新
        prevUnread.set(roomId, unreadCount);

        console.log(LOG_PREFIX, `  取得メッセージ: ${res.messages.length}件, 送信者: ${res.messages.map((m: { account?: { account_id?: number; name?: string } }) => `${m.account?.name ?? "?"}(${m.account?.account_id})`).slice(0, 5).join(", ")}${res.messages.length > 5 ? "..." : ""}`);

        // メッセージの送信者にVIPがいるか判定
        const hit = findVipHit(res.messages, vipIds, vips);
        if (hit) {
          console.log(LOG_PREFIX, `  ★ VIPヒット! roomId=${roomId}, VIP=${hit.name}(${hit.accountId}), color=${hit.color}`);
          applyVipBadge(item, hit.color);
        } else {
          console.log(LOG_PREFIX, `  VIPなし: roomId=${roomId}`);
          removeVipBadge(item);
        }
      } catch (e) {
        console.error(LOG_PREFIX, `  エラー: roomId=${roomId}`, e);
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

function waitForRoomList(): Promise<void> {
  return new Promise((resolve) => {
    // 既にDOMにあればすぐ返す
    if (document.querySelector(ROOM_ITEM_SELECTOR)) {
      resolve();
      return;
    }

    console.log(LOG_PREFIX, "ルーム一覧のDOM描画を待機中...");
    const observer = new MutationObserver(() => {
      if (document.querySelector(ROOM_ITEM_SELECTOR)) {
        observer.disconnect();
        console.log(LOG_PREFIX, "ルーム一覧のDOM描画を検知");
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 30秒でタイムアウト
    setTimeout(() => {
      observer.disconnect();
      console.warn(LOG_PREFIX, "ルーム一覧の待機タイムアウト（30秒）");
      resolve();
    }, 30_000);
  });
}

export function initVipNotify(): void {
  console.log(LOG_PREFIX, "初期化開始");
  injectStyles();
  // ルーム一覧のDOM描画を待ってから初回スキャン＋ポーリング開始
  waitForRoomList().then(() => {
    scan();
    scanTimer = setInterval(scan, SCAN_INTERVAL_MS);
    console.log(LOG_PREFIX, `ポーリング開始: ${SCAN_INTERVAL_MS / 1000}秒間隔`);
  });
}

export function destroyVipNotify(): void {
  console.log(LOG_PREFIX, "破棄");
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
