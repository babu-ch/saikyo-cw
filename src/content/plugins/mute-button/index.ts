import type { CwPlugin } from "../types";
import { waitForElement, sleep } from "../../../shared/dom-helpers";

const STYLE_ID = "scw-mute-button-style";
const BTN_CLASS = "scw-mute-button";
const BTN_ACTIVE_CLASS = "scw-mute-button--active";

let muteBtn: HTMLButtonElement | null = null;
let isBusy = false;

const STYLES = `
  .${BTN_CLASS} {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 10000;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: #4c566a;
    color: white;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: background 0.2s;
  }

  .${BTN_CLASS}:hover { background: #5c6678; }

  .${BTN_CLASS}.${BTN_ACTIVE_CLASS} { background: #bf616a; }
  .${BTN_CLASS}.${BTN_ACTIVE_CLASS}:hover { background: #cf717a; }

  body.mainContentArea--dark .${BTN_CLASS},
  body[data-theme="dark"] .${BTN_CLASS},
  .darkMode .${BTN_CLASS} {
    background: #5c6678;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }
  body.mainContentArea--dark .${BTN_CLASS}:hover,
  body[data-theme="dark"] .${BTN_CLASS}:hover,
  .darkMode .${BTN_CLASS}:hover { background: #6c768a; }

  body.mainContentArea--dark .${BTN_CLASS}.${BTN_ACTIVE_CLASS},
  body[data-theme="dark"] .${BTN_CLASS}.${BTN_ACTIVE_CLASS},
  .darkMode .${BTN_CLASS}.${BTN_ACTIVE_CLASS} { background: #bf616a; }
`;

async function toggleMute(): Promise<void> {
  if (isBusy) return;
  isBusy = true;

  try {
    // 1. 歯車ボタンをクリック
    const settingsBtn = document.querySelector<HTMLElement>(
      '[data-testid="room-header_room-settings-button"]',
    );
    if (!settingsBtn) throw new Error("設定ボタンが見つかりません");
    settingsBtn.click();

    await sleep(300);

    // 2. メニューから「グループチャットの設定」をクリック
    const menuItem = await waitForElement(
      '[data-testid="room-header_room-settings_room-settings-menu"]',
      3000,
    );
    (menuItem as HTMLElement).click();

    await sleep(500);

    // 3. 「ミュート」タブをクリック
    const tabs = document.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
    let muteTab: HTMLButtonElement | null = null;
    for (const tab of tabs) {
      if (tab.textContent?.trim() === "ミュート") {
        muteTab = tab;
        break;
      }
    }
    if (!muteTab) throw new Error("ミュートタブが見つかりません");
    muteTab.click();

    await sleep(300);

    // 4. ミュートチェックボックスをトグル
    const muteCheckbox = await waitForElement("#_roomSettingMute", 3000) as HTMLInputElement;
    muteCheckbox.click();

    await sleep(200);

    // 5. 保存ボタンをクリック
    const saveBtn = document.querySelector<HTMLElement>(
      '[data-testid="room-setting-dialog_save-button"]',
    );
    if (!saveBtn) throw new Error("保存ボタンが見つかりません");
    saveBtn.click();

    // ボタンの見た目を更新
    const nowMuted = muteCheckbox.checked;
    if (muteBtn) {
      muteBtn.textContent = nowMuted ? "🔇" : "🔔";
      muteBtn.classList.toggle(BTN_ACTIVE_CLASS, nowMuted);
      muteBtn.title = nowMuted ? "ミュート中（クリックで解除）" : "ミュートする";
    }
  } catch (err) {
    console.error("[saikyo-cw] Mute error:", err);
    // メニューやモーダルが残っていたら閉じる
    const closeBtn = document.querySelector<HTMLElement>(
      '.dialogContainer button[aria-label="閉じる"]',
    );
    closeBtn?.click();
  } finally {
    isBusy = false;
  }
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export const muteButtonPlugin: CwPlugin = {
  config: {
    id: "mute-button",
    name: "Mute Button",
    description: "ワンクリックでチャットをミュート",
    defaultEnabled: true,
  },
  init() {
    injectStyles();
    muteBtn = document.createElement("button");
    muteBtn.className = BTN_CLASS;
    muteBtn.title = "ミュートする";
    muteBtn.textContent = "🔔";
    muteBtn.addEventListener("click", toggleMute);
    document.body.appendChild(muteBtn);
  },
  destroy() {
    muteBtn?.remove();
    muteBtn = null;
    document.getElementById(STYLE_ID)?.remove();
  },
};
