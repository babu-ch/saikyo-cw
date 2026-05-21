import type { CwPlugin } from "../types";
import { CW } from "../../../shared/chatwork-selectors";
import { observeDOM } from "../../../shared/mutation-observer";
import { getApiToken, getPluginConfig, storageKeyForPlugin } from "../../../shared/storage";
import { showToast } from "../../../shared/toast";
import { showConfirmDialog } from "../../../shared/confirm-dialog";

const PLUGIN_ID = "quick-delete";
const MARKER = "__scw_quick_delete";
const STYLE_ID = "scw-quick-delete-style";
const BTN_CLASS = "scw-quick-delete-btn";
const DEBUG_PREFIX = "[saikyo-cw][quick-delete]";

export type QuickDeletePosition = "left" | "right";
export interface QuickDeleteConfig {
  position?: QuickDeletePosition;
}

let observer: MutationObserver | null = null;
let cachedMyAccountId: string | null = null;
let currentPosition: QuickDeletePosition = "left";
let storageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0] | null = null;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${BTN_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 16px;
      height: 16px;
      min-width: 16px;
      min-height: 16px;
      border: none;
      background: rgba(0,0,0,0.06);
      color: #888;
      border-radius: 50%;
      font-size: 10px;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transition: opacity .1s ease, background .1s ease, color .1s ease;
      padding: 0;
      margin: 0 4px;
      align-self: center;
    }
    [id^=_messageId]:hover .${BTN_CLASS} { opacity: 1; }
    .${BTN_CLASS}:hover {
      background: #d33;
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}

async function getMyAccountId(token: string): Promise<string | null> {
  if (cachedMyAccountId) return cachedMyAccountId;
  try {
    const res = await chrome.runtime.sendMessage({ type: "fetchMe", token });
    if (!res?.ok) return null;
    cachedMyAccountId = String(res.me.account_id);
    return cachedMyAccountId;
  } catch {
    return null;
  }
}

function getMessagePreview(msg: Element): string {
  const spans = msg.querySelectorAll("pre span");
  const text = Array.from(spans).map((e) => (e as HTMLElement).innerText).join("\n").trim();
  if (!text) return "";
  return text.length > 120 ? text.slice(0, 120) + "…" : text;
}

function accountIdOf(msg: Element): string {
  const direct = msg.getAttribute("data-aid");
  if (direct) return direct;
  const inner = msg.querySelector<HTMLElement>("[data-aid]");
  if (inner) return inner.getAttribute("data-aid") ?? "";

  // 連続メッセージ（アバター省略）の場合、直前のメッセージから data-aid を継承する。
  // メッセージは data-index 属性で順序付けされているので、それで直前を特定する。
  const myIdx = Number(msg.getAttribute("data-index"));
  if (!Number.isFinite(myIdx)) return "";

  const allMessages = document.querySelectorAll<HTMLElement>("[id^=_messageId][data-index]");
  let bestIdx = -Infinity;
  let bestAid = "";
  for (const m of Array.from(allMessages)) {
    const idx = Number(m.getAttribute("data-index"));
    if (!Number.isFinite(idx) || idx >= myIdx) continue;
    if (idx <= bestIdx) continue;
    const aid = m.querySelector<HTMLElement>("[data-aid]")?.getAttribute("data-aid");
    if (aid) {
      bestIdx = idx;
      bestAid = aid;
    }
  }
  return bestAid;
}

async function deleteMessage(roomId: string, messageId: string, token: string): Promise<boolean> {
  try {
    const res = await chrome.runtime.sendMessage({
      type: "deleteMessage",
      token,
      roomId,
      messageId,
    });
    if (!res?.ok) {
      console.warn(DEBUG_PREFIX, "delete failed:", res?.error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(DEBUG_PREFIX, "delete exception:", e);
    return false;
  }
}

// _timeStamp の出現タイミングで挿入する（observerが _timeStamp を直接観察）
function injectButton(timeStampEl: Element, myAccountId: string, token: string): void {
  if ((timeStampEl as unknown as Record<string, unknown>)[MARKER]) return;
  (timeStampEl as unknown as Record<string, unknown>)[MARKER] = true;

  const msg = timeStampEl.closest("[id^=_messageId]");
  if (!msg) return;

  const senderId = accountIdOf(msg);
  if (!senderId || senderId !== myAccountId) return;

  const roomId = msg.getAttribute("data-rid") ?? "";
  const messageId = msg.getAttribute("data-mid") ?? "";
  if (!/^\d+$/.test(roomId) || !/^\d+$/.test(messageId)) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BTN_CLASS;
  btn.textContent = "×";
  btn.title = "メッセージを削除";
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const preview = getMessagePreview(msg);
    const ok = await showConfirmDialog({
      title: "メッセージ削除",
      message: "以下のメッセージを削除します。この操作は取り消せません。",
      preview: preview || undefined,
      okText: "削除する",
      cancelText: "キャンセル",
      danger: true,
    });
    if (!ok) return;
    const deleted = await deleteMessage(roomId, messageId, token);
    if (deleted) {
      showToast("削除しました");
      msg.remove();
    } else {
      showToast("削除に失敗しました");
    }
  });

  // _timeStamp は position: absolute かつ display: flex なので、
  // btn を _timeStamp の子要素として置けばテキストと並列に並び絶対配置に追従する。
  if (currentPosition === "left") {
    timeStampEl.prepend(btn);
  } else {
    timeStampEl.appendChild(btn);
  }
}

async function loadConfig(): Promise<void> {
  const c = await getPluginConfig<QuickDeleteConfig>(PLUGIN_ID);
  currentPosition = c?.position === "right" ? "right" : "left";
}

export const quickDeletePlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "クイック削除",
    description: "自分のメッセージにhoverすると右上に×ボタンが表示され、ワンクリック（確認ダイアログあり）で削除（共通APIキー必須）",
    defaultEnabled: false,
  },
  async init() {
    const token = await getApiToken();
    if (!token) {
      console.warn(DEBUG_PREFIX, "APIキーが未設定のため有効化しません");
      return;
    }
    const myAccountId = await getMyAccountId(token);
    if (!myAccountId) {
      console.warn(DEBUG_PREFIX, "自分のaccount_idが取得できないため有効化しません");
      return;
    }
    await loadConfig();
    injectStyle();
    // _timeStamp は遅れて描画される場合があるので、メッセージ要素ではなく _timeStamp 自体を観察する
    observer = observeDOM("[id^=_messageId] ._timeStamp", (el) =>
      injectButton(el, myAccountId, token),
    );

    // 位置設定変更を監視 (新規メッセージから反映される)
    storageListener = (changes, area) => {
      if (area !== "sync") return;
      if (changes[storageKeyForPlugin(PLUGIN_ID)]) loadConfig();
    };
    chrome.storage.onChanged.addListener(storageListener);
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    if (storageListener) {
      chrome.storage.onChanged.removeListener(storageListener);
      storageListener = null;
    }
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove());
  },
};
