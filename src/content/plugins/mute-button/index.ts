import type { CwPlugin } from "../types";

let muteBtn: HTMLElement | null = null;
let isMuted = false;

function createMuteButton(): HTMLElement {
  const btn = document.createElement("button");
  btn.setAttribute("data-scw-mute", "true");
  btn.title = "Mute notifications";
  btn.style.cssText = `
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
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: background 0.2s;
  `;
  btn.textContent = "🔔";
  btn.addEventListener("click", toggleMute);
  return btn;
}

function toggleMute(): void {
  isMuted = !isMuted;
  if (muteBtn) {
    muteBtn.textContent = isMuted ? "🔇" : "🔔";
    muteBtn.style.background = isMuted ? "#bf616a" : "#4c566a";
    muteBtn.title = isMuted ? "Unmute notifications" : "Mute notifications";
  }

  // Chatworkの通知音要素をミュート/アンミュート
  const audioElements = document.querySelectorAll("audio");
  audioElements.forEach((audio) => {
    audio.muted = isMuted;
  });

  // デスクトップ通知の抑制（Notification APIをオーバーライド）
  if (isMuted) {
    (window as unknown as Record<string, unknown>).__scw_origNotification =
      window.Notification;
    (window.Notification as unknown) = class {
      constructor() {
        // 何もしない
      }
    };
  } else {
    const orig = (window as unknown as Record<string, unknown>)
      .__scw_origNotification as typeof Notification | undefined;
    if (orig) {
      (window.Notification as unknown) = orig;
    }
  }
}

export const muteButtonPlugin: CwPlugin = {
  config: {
    id: "mute-button",
    name: "Mute Button",
    description: "ワンクリックで通知をミュート",
  },
  init() {
    muteBtn = createMuteButton();
    document.body.appendChild(muteBtn);
  },
  destroy() {
    if (isMuted) {
      toggleMute(); // アンミュートしてクリーンアップ
    }
    muteBtn?.remove();
    muteBtn = null;
  },
};
