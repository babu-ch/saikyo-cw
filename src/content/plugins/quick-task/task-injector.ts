import { EXTENSION_PREFIX, CW_BASE_URL } from "../../../shared/constants";
import { waitForElement, sleep } from "../../../shared/dom-helpers";
import { setReactInputValue } from "../../../shared/react-input";
import { getPluginConfig, setPluginConfig } from "../../../shared/storage";

const PLUGIN_ID = "quick-task";

interface QuickTaskConfig {
  myChatId?: string;
}

async function getMyChatId(): Promise<string> {
  const config = await getPluginConfig<QuickTaskConfig>(PLUGIN_ID);
  if (config?.myChatId) return config.myChatId;

  const id = prompt(
    "タスクを投稿するマイチャットのルームIDを入力してください\n" +
      "(URLの #!rid の後の数字)",
  );
  if (!id) throw new Error("Room ID is required");

  await setPluginConfig(PLUGIN_ID, { myChatId: id });
  return id;
}

function getMessageInfo(actionNav: Element): {
  messageId: string;
  roomId: string;
  messageText: string;
} | null {
  // メッセージ要素を探す
  const messageEl = actionNav.closest("[id^=_messageId]");
  if (!messageEl) return null;

  const messageId = messageEl.id.replace("_messageId", "");

  // 現在のルームIDをURLから取得
  const match = location.hash.match(/#!rid(\d+)/);
  const roomId = match?.[1] ?? "";

  // メッセージ本文を取得
  const bodyEl = messageEl.querySelector(".chatTimeLineMessageArea__messageText");
  const messageText =
    bodyEl?.textContent?.trim().substring(0, 200) ?? "";

  return { messageId, roomId, messageText };
}

async function createMyTask(
  roomId: string,
  messageId: string,
  messageText: string,
): Promise<void> {
  const myChatId = await getMyChatId();
  const messageUrl = `${CW_BASE_URL}#!rid${roomId}-${messageId}`;

  const taskContent = messageText
    ? `${messageText}\n${messageUrl}`
    : messageUrl;

  // マイチャットに遷移
  location.href = `${CW_BASE_URL}#!rid${myChatId}`;

  await sleep(500);

  // タスク追加ボタンを探してクリック
  const taskAddBtn = await waitForElement(
    '[data-testid="room-sub-column_room-task_add-button"], #_taskAddButton',
  );
  (taskAddBtn as HTMLElement).click();

  await sleep(300);

  // タスク入力欄にテキストを入力
  const taskInput = await waitForElement(
    '#_taskInputActive textarea, [data-testid="task-input"] textarea',
  );
  setReactInputValue(taskInput as HTMLTextAreaElement, taskContent);

  await sleep(200);

  // 送信ボタンをクリック
  const submitBtn = document.querySelector(
    '#_taskAddSubmit, [data-testid="task-add-submit"]',
  ) as HTMLElement | null;
  if (submitBtn) {
    submitBtn.click();
  }
}

export function injectMyTaskButton(actionNav: Element): void {
  // 既にボタンがあればスキップ
  if (actionNav.querySelector(`[data-${EXTENSION_PREFIX}-mytask]`)) return;

  const btn = document.createElement("li");
  btn.setAttribute(`data-${EXTENSION_PREFIX}-mytask`, "true");
  btn.style.cssText = "display: inline-block; cursor: pointer; margin-left: 4px;";
  btn.title = "My Taskに追加";
  btn.innerHTML = `
    <span style="
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 4px;
      font-size: 14px;
      background: #e8f4fd;
      transition: background 0.15s;
    ">📋</span>
  `;

  btn.addEventListener("mouseenter", () => {
    const span = btn.querySelector("span");
    if (span) span.style.background = "#c8e4fd";
  });
  btn.addEventListener("mouseleave", () => {
    const span = btn.querySelector("span");
    if (span) span.style.background = "#e8f4fd";
  });

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const info = getMessageInfo(actionNav);
    if (!info) return;

    try {
      await createMyTask(info.roomId, info.messageId, info.messageText);
    } catch (err) {
      console.error("[saikyo-cw] Quick Task error:", err);
    }
  });

  actionNav.appendChild(btn);
}
