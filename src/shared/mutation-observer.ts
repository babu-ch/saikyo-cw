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
