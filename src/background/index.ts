import { log, warn } from "../shared/logger";

chrome.runtime.onInstalled.addListener(() => {
  console.log("saikyo-cw installed");
});

// ===== 自動既読 =====

const PLUGIN_PREFIX = "plugin_";
const AUTO_READ_PLUGIN_ID = "vip-notify";

interface AutoReadRoomConfig {
  enabled: boolean;
  keywords: string[];
}

interface AutoReadRoom {
  roomId: string;
  unreadCount: number;
  messages?: Array<{ message_id: string; body?: string; account?: { account_id?: number } }>;
}

async function getAutoReadConfig(): Promise<Record<string, AutoReadRoomConfig>> {
  const key = `${PLUGIN_PREFIX}${AUTO_READ_PLUGIN_ID}`;
  const data = await chrome.storage.sync.get(key);
  const config = data[key]?.config;
  return config?.autoReadRooms ?? {};
}

function isValidRoomId(id: unknown): id is string {
  return typeof id === "string" && /^\d+$/.test(id);
}

async function fetchMessagesForRoom(
  roomId: string,
  token: string,
): Promise<Array<{ message_id: string; body?: string; account?: { account_id?: number } }>> {
  if (!isValidRoomId(roomId)) throw new Error("Invalid roomId");
  const res = await fetch(
    `https://api.chatwork.com/v2/rooms/${roomId}/messages?force=1`,
    { headers: { "X-ChatWorkToken": token } },
  );
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

function extractText(body: string): string {
  return body
    .replace(/\[To:\d+\]/g, " ")
    .replace(/\[rp[^\]]*\][\s\S]*?\[\/rp\]/g, " ")
    .replace(/\[[^[\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldKeepMessage(
  msg: { body?: string; account?: { account_id?: number } },
  vipIds: number[],
  myAccountId: number | null,
  keywords: string[],
): boolean {
  const senderId = msg.account?.account_id;

  // VIPの発言は残す
  if (senderId != null && vipIds.includes(senderId)) return true;

  const body = msg.body ?? "";

  // 自分宛てのTo/リプライは残す
  if (myAccountId) {
    const toIds = [...body.matchAll(/\[To:(\d+)\]/gi)].map((m) => Number(m[1]));
    if (toIds.includes(myAccountId)) return true;
    const rpId = Number(body.match(/\[rp\s+aid=(\d+)/)?.[1]) || null;
    if (rpId === myAccountId) return true;
  }

  // キーワードを含む発言は残す
  const text = extractText(body).toLocaleLowerCase();
  if (keywords.some((kw) => text.includes(kw.toLocaleLowerCase()))) return true;

  return false;
}

async function handleAutoRead(
  token: string,
  rooms: AutoReadRoom[],
  vipIds: number[],
  myAccountId: number | null,
): Promise<{ readRooms: string[] }> {
  const autoReadConfig = await getAutoReadConfig();
  log("autoRead config:", JSON.stringify(autoReadConfig), "rooms:", rooms.length);
  const readRooms: string[] = [];

  for (const room of rooms) {
    const config = autoReadConfig[room.roomId];
    warn(`autoRead room=${room.roomId}, config=`, config);
    if (!config?.enabled) continue;

    // メッセージ取得（content.jsから渡されていればそれを使う）
    let messages = room.messages;
    if (!messages) {
      try {
        warn(`autoRead fetching messages for room=${room.roomId}`);
        messages = await fetchMessagesForRoom(room.roomId, token);
      } catch (e) {
        warn(`autoRead fetchMessages failed room=${room.roomId}`, e);
        continue;
      }
    }

    if (!messages || messages.length === 0) continue;

    // 未読分のメッセージだけ判定（末尾からunreadCount件）
    const candidates = messages.slice(-room.unreadCount);
    warn(`autoRead room=${room.roomId}, messages=${messages.length}, candidates=${candidates.length}`);

    // 全未読メッセージが既読対象かチェック
    const allAutoRead = candidates.every(
      (msg) => !shouldKeepMessage(msg, vipIds, myAccountId, config.keywords),
    );

    warn(`autoRead room=${room.roomId}, allAutoRead=${allAutoRead}`);
    if (!allAutoRead) continue;

    // 全部既読対象 → 最新メッセージIDで既読化
    const sorted = [...messages].sort((a, b) => {
      const na = BigInt(a.message_id || "0");
      const nb = BigInt(b.message_id || "0");
      return na > nb ? 1 : na < nb ? -1 : 0;
    });
    const latestMsgId = sorted[sorted.length - 1].message_id;

    try {
      warn(`autoRead marking read room=${room.roomId}, msgId=${latestMsgId}`);
      const res = await fetch(
        `https://api.chatwork.com/v2/rooms/${room.roomId}/messages/read`,
        {
          method: "PUT",
          headers: {
            "X-ChatWorkToken": token,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ message_id: latestMsgId }).toString(),
        },
      );
      warn(`autoRead PUT result room=${room.roomId}, status=${res.status}`);
      if (res.ok) {
        readRooms.push(room.roomId);
      }
    } catch (e) {
      warn(`autoRead PUT failed room=${room.roomId}`, e);
    }
  }

  return { readRooms };
}

// Chatwork API プロキシ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // sender検証: 自拡張またはchatwork.comからのみ受け付ける
  const isFromExtension = sender.id === chrome.runtime.id;
  const isFromChatwork = sender.url?.startsWith("https://www.chatwork.com/");
  if (!isFromExtension && !isFromChatwork) {
    sendResponse({ ok: false });
    return;
  }

  const { token } = message;

  if (message.type === "fetchMembers") {
    if (!isValidRoomId(message.roomId)) {
      sendResponse({ ok: false });
      return;
    }
    fetch(
      `https://api.chatwork.com/v2/rooms/${message.roomId}/members`,
      { headers: { "X-ChatWorkToken": token } },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((members) => sendResponse({ ok: true, members }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "fetchMe") {
    fetch("https://api.chatwork.com/v2/me", {
      headers: { "X-ChatWorkToken": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((me) => sendResponse({ ok: true, me }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "fetchRooms") {
    fetch("https://api.chatwork.com/v2/rooms", {
      headers: { "X-ChatWorkToken": token },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((rooms) => sendResponse({ ok: true, rooms }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "autoRead") {
    handleAutoRead(message.token, message.rooms, message.vipIds, message.myAccountId)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (message.type === "fetchMessages") {
    if (!isValidRoomId(message.roomId)) {
      sendResponse({ ok: false });
      return;
    }
    fetch(
      `https://api.chatwork.com/v2/rooms/${message.roomId}/messages?force=1`,
      { headers: { "X-ChatWorkToken": token } },
    )
      .then((res) => {
        // 204 No Content = 未読なし → 空配列として返す
        if (res.status === 204) return [];
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((messages) => sendResponse({ ok: true, messages: Array.isArray(messages) ? messages : [] }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});
