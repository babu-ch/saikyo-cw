export function waitForElement(
  selector: string,
  timeout = 5000,
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for: ${selector}`));
    }, timeout);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * find() が値を返すまで待つ。見つからないままtimeoutしたらnull。
 * MutationObserverのコールバック内（描画前）でresolveするので、見つけたポップアップをすぐ隠せばちらつかない。
 */
export function waitFor<T>(find: () => T | null, timeout = 1000): Promise<T | null> {
  return new Promise((resolve) => {
    const found = find();
    if (found) return resolve(found);

    const observer = new MutationObserver(() => {
      const el = find();
      if (el) {
        cleanup();
        resolve(el);
      }
    });
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeout);
    function cleanup(): void {
      observer.disconnect();
      clearTimeout(timer);
    }
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/**
 * trigger() の後に新しく現れた要素だけを待つ。見つからないままtimeoutしたらnull。
 * trigger() の前から同じ形の要素が残っていても（別のメッセージのポップアップなど）取り違えない。
 * CWのポップアップは開くたびに新しい要素として描画されるので、前からあるものは今回開いたものではない。
 */
export function waitForNew(
  findAll: () => Iterable<Element>,
  trigger: () => void,
  timeout = 1000,
): Promise<Element | null> {
  const before = new Set(findAll());
  trigger();
  return waitFor(() => {
    for (const el of findAll()) {
      if (!before.has(el)) return el;
    }
    return null;
  }, timeout);
}
