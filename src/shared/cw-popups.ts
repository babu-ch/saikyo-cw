import { CW } from "./chatwork-selectors";
import { waitFor } from "./dom-helpers";

// CWのポップアップ（その他メニュー・リアクション一覧）は #_wrapper 直下の position: fixed の箱に描画される
function popupRoot(el: Element): HTMLElement {
  let root = el as HTMLElement;
  while (
    root.parentElement &&
    root.parentElement.id !== "_wrapper" &&
    root.parentElement !== document.body
  ) {
    root = root.parentElement;
  }
  return root;
}

/** 裏で操作するポップアップを見えなくし、中身が消えたら（消えないままならtimeout後に）元に戻す */
export function hideUntilClosed(el: Element, timeout = 1000): void {
  const root = popupRoot(el);
  // ポップアップでないものを渡されてもタイムラインごと隠さない
  if (root.querySelector(CW.MESSAGE)) return;
  const prev = root.style.visibility;
  root.style.visibility = "hidden";
  void waitFor(() => (el.isConnected && root.isConnected ? null : true), timeout).then(() => {
    root.style.visibility = prev;
  });
}
