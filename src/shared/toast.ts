const TOAST_ID = "scw-shared-toast";
const STYLE_ID = "scw-shared-toast-style";

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${TOAST_ID} {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(40,40,40,0.95);
      color: #fff;
      padding: 10px 18px;
      border-radius: 8px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,.25);
      font-size: 13px;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity .2s ease, transform .2s ease;
      pointer-events: none;
      white-space: pre-wrap;
      max-width: 360px;
    }
    #${TOAST_ID}.scw-toast-show {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.appendChild(style);
}

export function showToast(message: string, durationMs = 2500): void {
  injectStyle();
  document.getElementById(TOAST_ID)?.remove();
  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("scw-toast-show"));
  setTimeout(() => {
    toast.classList.remove("scw-toast-show");
    setTimeout(() => toast.remove(), 250);
  }, durationMs);
}

export function hideToast(): void {
  document.getElementById(TOAST_ID)?.remove();
}
