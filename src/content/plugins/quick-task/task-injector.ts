import { CW_BASE_URL } from "../../../shared/constants";
import { sleep } from "../../../shared/dom-helpers";
import { setReactInputValue } from "../../../shared/react-input";
import { getApiToken, getPluginConfig, setPluginConfig } from "../../../shared/storage";
import { showToast } from "../../../shared/toast";

const PLUGIN_ID = "quick-task";
const MARKER = "__scw_quick_task";

let cachedMyAccountId: string | null = null;

export type TaskMode =
  | "mychat-url"      // マイチャットにURL
  | "mychat-message"  // マイチャットにURL+メッセージ
  | "here-url"        // 現チャットにURL (担当者=自分)
  | "here-message";   // 現チャットにURL+メッセージ (担当者=自分)

interface QuickTaskConfig {
  myChatId?: string;
  mode?: TaskMode;
  // 期限のデフォルト日数（今日からのオフセット）。-1でなし
  deadlineDays?: number;
}

const DEFAULT_DEADLINE_DAYS = 3;

async function getConfig(): Promise<QuickTaskConfig> {
  return (await getPluginConfig<QuickTaskConfig>(PLUGIN_ID)) ?? {};
}

async function getMyChatId(): Promise<string> {
  const config = await getConfig();
  if (config.myChatId) return config.myChatId;

  const id = prompt(
    "taskを投稿するチャットのID(#!rid1234の1234の部分)",
  );
  if (!id) throw new Error("Room ID is required");

  const numericId = id.match(/^\d+$/)?.[0] ?? id.match(/\d+/)?.[0];
  if (!numericId) throw new Error("数値のIDを入力してください");
  await setPluginConfig(PLUGIN_ID, { ...config, myChatId: numericId });
  return numericId;
}

function getMessageElement(actionNav: Element): Element | null {
  return actionNav.closest("._message");
}

function getMessageUrl(message: Element): string {
  const rid = message.getAttribute("data-rid") ?? "";
  const mid = message.getAttribute("data-mid") ?? "";
  return `${CW_BASE_URL}#!rid${rid}-${mid}`;
}

function getMessageText(message: Element): string {
  const spans = message.querySelectorAll("pre span");
  return Array.from(spans).map((e) => (e as HTMLElement).innerText).join("\n");
}

// CW純正の「引用」機能を経由して本文を取得する。
// 引用ボタンを押すと #_chatText に `[引用 aid=xxx time=yyy]本文[/引用]` 形式の記法が挿入されるので、
// 差分を取り出して下書きは元に戻す。引用記法ならタスク欄でも送信者アイコン付きで表示される。
async function getMessageTextViaQuote(message: Element): Promise<string | null> {
  try {
    let nav = message.querySelector(".messageActionNav");
    if (!nav) {
      message.dispatchEvent(
        new MouseEvent("mouseover", { bubbles: true, cancelable: true }),
      );
      await sleep(200);
      nav = message.querySelector(".messageActionNav");
    }
    if (!nav) return null;

    const quoteBtn = (
      nav.querySelector('use[href="#icon_quote"]') as Element | null
    )?.closest("button") as HTMLElement | null;
    if (!quoteBtn) return null;

    const input = document.querySelector<HTMLTextAreaElement>("#_chatText");
    if (!input) return null;

    const before = input.value;
    quoteBtn.click();
    await sleep(300);

    const after = input.value;
    let quoted = after.startsWith(before) ? after.slice(before.length) : after;
    quoted = quoted.replace(/^\s+|\s+$/g, "");

    // 下書きを元に戻す（Reactに変更通知）
    setReactInputValue(input, before);

    return quoted || null;
  } catch (e) {
    console.warn("[saikyo-cw][quick-task] quote本文取得に失敗、innerTextへフォールバック:", e);
    return null;
  }
}

async function setTaskInput(input: HTMLTextAreaElement, value: string): Promise<void> {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(input, value);
  }
  input.value = value;
  const tracker = (input as unknown as { _valueTracker?: { setValue(v: string): void } })
    ._valueTracker;
  if (tracker) {
    tracker.setValue("hello");
  }
  await sleep(200);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function assignToSelf(): Promise<void> {
  try {
    const event = new MouseEvent("mouseover", {
      bubbles: true,
      cancelable: true,
    });
    // 担当者ボタンを探してhoverイベントを発火
    const buttons = document.querySelectorAll("#_taskInputActive button");
    buttons.forEach((e) => e.dispatchEvent(event));
    await sleep(200);
    // 1つ目のアイコンが自分
    const selfIcon = document.querySelector<HTMLElement>(
      ".floatingComponentContainer .userIconImage",
    );
    selfIcon?.click();
  } catch (e) {
    console.warn("[saikyo-cw] assignToSelf:", e);
  }
  await sleep(200);
}

function getPickerMonth(picker: Element): { y: number; m: number } | null {
  // <p>2026年 5月</p> を月送りヘッダから読む
  const ps = picker.querySelectorAll("p");
  for (const p of Array.from(ps)) {
    const match = p.textContent?.match(/(\d+)年\s*(\d+)月/);
    if (match) return { y: Number(match[1]), m: Number(match[2]) };
  }
  return null;
}

async function setDeadline(days: number): Promise<void> {
  if (days < 0) return; // 設定なし

  // 期限ブロックの日付テキスト（「5月15日」形式）をクリックしてカレンダーを開く
  const taskArea = document.querySelector("#_taskInputActive");
  if (!taskArea) return;
  const dateBtn = Array.from(taskArea.querySelectorAll("p")).find((p) =>
    /^\d+月\d+日$/.test((p.textContent ?? "").trim()),
  );
  if (!dateBtn) {
    console.warn("[saikyo-cw][quick-task] 期限の日付ボタンが見つかりません");
    return;
  }
  (dateBtn as HTMLElement).click();
  await sleep(300);

  const picker = document.querySelector('[data-testid="date-picker"]');
  if (!picker) {
    console.warn("[saikyo-cw][quick-task] date-pickerが開きません");
    return;
  }

  const target = new Date();
  target.setDate(target.getDate() + days);
  const ty = target.getFullYear();
  const tm = target.getMonth() + 1;
  const td = target.getDate();
  const targetDateAttr = `${ty}-${tm}-${td}`; // CWは0埋めなし形式

  // 表示中の月をターゲット月まで進める（datetime属性は前後月セルにも入っているのでクリックすると月をまたぐ可能性があるため、確実にターゲット月に合わせる）
  for (let i = 0; i < 12; i++) {
    const cur = getPickerMonth(picker);
    if (!cur) break;
    if (cur.y === ty && cur.m === tm) break;
    const nextBtn = Array.from(picker.querySelectorAll("button")).find((b) =>
      b.querySelector('use[href="#icon_triangleRight"]'),
    );
    if (!nextBtn) break;
    (nextBtn as HTMLElement).click();
    await sleep(150);
  }

  // ターゲット日付セルをクリック
  const cell = picker.querySelector<HTMLElement>(
    `time[datetime="${targetDateAttr}"]`,
  );
  if (cell) {
    cell.click();
    await sleep(150);
  } else {
    console.warn("[saikyo-cw][quick-task] 対象日のセルが見つかりません:", targetDateAttr);
  }

  // 「閉じる」ボタンを押してピッカーを閉じる
  const closeBtn = Array.from(picker.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === "閉じる",
  );
  (closeBtn as HTMLElement | undefined)?.click();
  await sleep(150);
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

function deadlineUnix(days: number): number | null {
  if (days < 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return Math.floor(d.getTime() / 1000);
}

// メッセージAPIから生body・送信者ID・送信時刻を取得
async function fetchMessageMeta(
  token: string,
  roomId: string,
  messageId: string,
): Promise<{ body: string; aid: number; sendTime: number } | null> {
  try {
    const res = await chrome.runtime.sendMessage({
      type: "fetchMessage",
      token,
      roomId,
      messageId,
    });
    if (!res?.ok || !res.message) return null;
    return {
      body: String(res.message.body ?? ""),
      aid: Number(res.message.account?.account_id ?? 0),
      sendTime: Number(res.message.send_time ?? 0),
    };
  } catch {
    return null;
  }
}

// タスクAPI経由でタスクを登録する。成功すればtrue。
// APIトークンがあれば画面遷移なし＆DOM操作なしでタスク追加できる。
// 引用記法は内部記法の [qt][qtmeta aid=X time=Y]本文[/qt] を自前で組み立てる。
async function tryExecuteTaskViaApi(
  message: Element,
  mode: TaskMode,
  deadlineDays: number,
): Promise<boolean> {
  const token = await getApiToken();
  if (!token) return false;

  const isHere = mode === "here-url" || mode === "here-message";
  const includeMessage = mode === "mychat-message" || mode === "here-message";

  const messageRoomId = message.getAttribute("data-rid") ?? "";
  const messageId = message.getAttribute("data-mid") ?? "";
  if (!/^\d+$/.test(messageRoomId) || !/^\d+$/.test(messageId)) return false;

  // 投稿先roomId
  let targetRoomId: string;
  if (isHere) {
    targetRoomId = messageRoomId;
  } else {
    try {
      targetRoomId = await getMyChatId();
    } catch {
      return false;
    }
  }
  if (!/^\d+$/.test(targetRoomId)) return false;

  // 本文組み立て: URL + 引用
  const url = `${CW_BASE_URL}#!rid${messageRoomId}-${messageId}`;
  let content = url;
  if (includeMessage) {
    const meta = await fetchMessageMeta(token, messageRoomId, messageId);
    if (!meta) return false;
    const quote = `[qt][qtmeta aid=${meta.aid} time=${meta.sendTime}]${meta.body}[/qt]`;
    content = `${url}\n${quote}`;
  }

  const myAccountId = await getMyAccountId(token);
  if (!myAccountId) return false;

  const limit = deadlineUnix(deadlineDays);

  try {
    const res = await chrome.runtime.sendMessage({
      type: "postTask",
      token,
      roomId: targetRoomId,
      body: content,
      toIds: myAccountId,
      limit,
    });
    return res?.ok === true;
  } catch {
    return false;
  }
}

async function executeTask(message: Element, mode: TaskMode, deadlineDays: number): Promise<void> {
  // APIキーがあればAPI経由（画面遷移なし＆DOM操作なし）
  if (await tryExecuteTaskViaApi(message, mode, deadlineDays)) {
    showToast("タスクを追加しました");
    return;
  }

  const url = getMessageUrl(message);
  const includeMessage = mode === "mychat-message" || mode === "here-message";
  const isHere = mode === "here-url" || mode === "here-message";

  let content = url;
  if (includeMessage) {
    const quoted = await getMessageTextViaQuote(message);
    const body = quoted ?? getMessageText(message);
    content = `${url}\n${body}`;
  }

  // === フォールバック: DOM操作経路 ===
  if (isHere) {
    // 現チャットのridに遷移（実質リロードなし）
    const rid = message.getAttribute("data-rid") ?? "";
    location.href = `${CW_BASE_URL}#!rid${rid}`;
  } else {
    const myChatId = await getMyChatId();
    location.href = `${CW_BASE_URL}#!rid${myChatId}`;
  }

  await sleep(200);

  // タスクエリアを開く
  const area = document.querySelector("#_taskAddArea");
  (area as HTMLElement)?.click();
  await sleep(200);

  // タスク入力
  const input = document.querySelector<HTMLTextAreaElement>(
    "#_taskInputActive textarea",
  );
  if (input) {
    await setTaskInput(input, content);
  }

  // 現チャット版は担当者を自分に設定
  if (isHere) {
    await assignToSelf();
  }

  // 期限を設定
  await setDeadline(deadlineDays);

  // 追加ボタン
  const addBtn = document.querySelector<HTMLElement>(
    'button[data-testid="room-sub-column_room-task_add-button"]',
  );
  addBtn?.click();
}

export function injectMyTaskButton(actionNav: Element): void {
  if ((actionNav as unknown as Record<string, unknown>)[MARKER]) return;
  (actionNav as unknown as Record<string, unknown>)[MARKER] = true;

  // 既存の「タスク」ボタンを探す
  const lis = actionNav.querySelectorAll(":scope > li");
  const taskLi = Array.from(lis).find(
    (li) => li.textContent?.trim() === "タスク",
  );
  if (!taskLi) return;

  // 「タスク」ボタンをcloneしてラベルを「my」に変更
  const cloned = taskLi.cloneNode(true) as HTMLElement;
  const label = cloned.querySelector(".actionLabel");
  if (label) {
    label.textContent = "my";
  }
  taskLi.insertAdjacentElement("afterend", cloned);

  cloned.addEventListener("click", async () => {
    const message = getMessageElement(actionNav);
    if (!message) return;

    const config = await getConfig();
    const mode = config.mode ?? "mychat-url";
    const deadlineDays = config.deadlineDays ?? DEFAULT_DEADLINE_DAYS;

    try {
      await executeTask(message, mode, deadlineDays);
    } catch (err) {
      console.error("[saikyo-cw] Quick Task error:", err);
    }
  });
}

export function removeStyles(): void {
  // スタイル注入は不要になった（既存ボタンのcloneなので）
}
