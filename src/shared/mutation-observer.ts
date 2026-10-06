import { CW } from "./chatwork-selectors";

/**
 * 指定セレクタにマッチする要素が追加されるたびにcallbackを呼ぶ。
 * 既存の要素にも即座にcallbackを実行する。
 * 同じ要素に対して重複呼び出しは行わない。
 */
export function observeDOM(
  selector: string,
  callback: (element: Element) => void,
  root: Node = document.body,
): MutationObserver {
  const processed = new WeakSet<Element>();

  const process = (el: Element) => {
    if (processed.has(el)) return;
    processed.add(el);
    callback(el);
  };

  // 既存要素を処理
  (root as Element).querySelectorAll?.(selector)?.forEach(process);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        const el = added as Element;
        if (el.matches?.(selector)) process(el);
        el.querySelectorAll?.(selector)?.forEach(process);
      }
    }
  });

  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

/**
 * メッセージのアクションメニューが出るたび（と中の項目が増えるたび）にcallbackを呼ぶ。
 * ページを開いて最初のホバーだけは、空のメニュー（ul）が先に追加されて項目（li）が後から入るので、
 * ulの追加だけを見ていると中身が空のときに空振りする。
 * 同じメニューで何度も呼ばれるので、callbackは追加済みなら何もしないように作る。
 */
export function observeActionNavs(callback: (actionNav: Element) => void): MutationObserver {
  document.body.querySelectorAll(CW.MESSAGE_ACTION_NAV).forEach((nav) => callback(nav));

  const observer = new MutationObserver((mutations) => {
    const navs = new Set<Element>();
    for (const m of mutations) {
      const target = m.target as Element;
      if (m.addedNodes.length > 0 && target.matches?.(CW.MESSAGE_ACTION_NAV)) navs.add(target);
      for (const added of m.addedNodes) {
        if (added.nodeType !== Node.ELEMENT_NODE) continue;
        const el = added as Element;
        if (el.matches(CW.MESSAGE_ACTION_NAV)) navs.add(el);
        el.querySelectorAll(CW.MESSAGE_ACTION_NAV).forEach((nav) => navs.add(nav));
      }
    }
    navs.forEach((nav) => callback(nav));
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}
