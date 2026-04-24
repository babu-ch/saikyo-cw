/**
 * スクロール中の進捗表示オーバーレイ。
 * 参考実装 chatwork-scroll-to-oldest の createOverlay 相当を継承。
 * 独自クラスプレフィックス `scw-export-` で他プラグインと衝突しないようにする。
 */

export interface ProgressOverlay {
  setText(text: string): void;
  finish(finalText: string, keepMs?: number): void;
  remove(): void;
  getStopButton(): HTMLButtonElement;
}

const OVERLAY_ID = "scw-export-overlay";

export function createProgressOverlay(onStop: () => void): ProgressOverlay {
  // 既存オーバーレイが残っていれば除去
  document.getElementById(OVERLAY_ID)?.remove();

  const wrap = document.createElement("div");
  wrap.id = OVERLAY_ID;
  Object.assign(wrap.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    background: "rgba(32,32,32,0.92)",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: "8px",
    font: "14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    minWidth: "300px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });

  const textEl = document.createElement("span");
  textEl.textContent = "🔄 過去ログを読み込んでいます…";
  textEl.style.cssText = "flex:1;min-width:0;";
  wrap.appendChild(textEl);

  const stopBtn = document.createElement("button");
  stopBtn.type = "button";
  stopBtn.textContent = "⏹ 停止";
  stopBtn.setAttribute("aria-label", "処理を停止する");
  Object.assign(stopBtn.style, {
    background: "rgba(255,90,100,0.25)",
    border: "1px solid rgba(255,140,150,0.9)",
    color: "#fff",
    padding: "5px 12px",
    borderRadius: "6px",
    font: "12px/1 -apple-system,BlinkMacSystemFont,sans-serif",
    fontWeight: "600",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: "0",
    transition: "background 0.15s",
    pointerEvents: "auto",
  });
  stopBtn.addEventListener("mouseenter", () => {
    if (!stopBtn.disabled) stopBtn.style.background = "rgba(255,90,100,0.5)";
  });
  stopBtn.addEventListener("mouseleave", () => {
    if (!stopBtn.disabled) stopBtn.style.background = "rgba(255,90,100,0.25)";
  });

  let stopped = false;
  const trigger = (e?: Event) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (stopped) return;
    stopped = true;
    stopBtn.disabled = true;
    stopBtn.style.opacity = "0.6";
    stopBtn.style.cursor = "default";
    stopBtn.textContent = "停止中…";
    textEl.textContent = "⏹ 停止処理中…";
    try {
      onStop();
    } catch (err) {
      console.error("[scw-export] onStop threw", err);
    }
  };
  stopBtn.addEventListener("pointerdown", trigger);
  stopBtn.addEventListener("click", trigger);
  wrap.appendChild(stopBtn);

  document.body.appendChild(wrap);

  return {
    setText(text: string) {
      textEl.textContent = text;
    },
    finish(finalText: string, keepMs = 3500) {
      textEl.textContent = finalText;
      stopBtn.style.display = "none";
      setTimeout(() => wrap.remove(), keepMs);
    },
    remove() {
      wrap.remove();
    },
    getStopButton() {
      return stopBtn;
    },
  };
}

export function playChime(): void {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [660, 880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.14;
      const end = start + 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end);
    });
    setTimeout(() => {
      try {
        ctx.close();
      } catch (_) {
        // ignore
      }
    }, 1200);
  } catch (_) {
    // ignore
  }
}
