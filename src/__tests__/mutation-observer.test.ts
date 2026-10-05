import { describe, it, expect, vi, afterEach } from "vitest";
import { observeActionNavs, observeDOM } from "../shared/mutation-observer";
import { injectMyTaskButton } from "../content/plugins/quick-task/task-injector";

describe("observeDOM", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("既存の要素に対してcallbackを呼ぶ", () => {
    document.body.innerHTML = '<div class="target">A</div><div class="target">B</div>';
    const cb = vi.fn();

    const observer = observeDOM(".target", cb);

    expect(cb).toHaveBeenCalledTimes(2);
    observer.disconnect();
  });

  it("動的に追加された要素に対してcallbackを呼ぶ", async () => {
    const cb = vi.fn();
    const observer = observeDOM(".dynamic", cb);

    const el = document.createElement("div");
    el.className = "dynamic";
    document.body.appendChild(el);

    // MutationObserverはマイクロタスクで呼ばれるので待つ
    await new Promise((r) => setTimeout(r, 0));

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(el);
    observer.disconnect();
  });

  it("同じ要素に対して重複してcallbackを呼ばない", async () => {
    document.body.innerHTML = '<div class="dup">X</div>';
    const cb = vi.fn();
    const observer = observeDOM(".dup", cb);

    // 既存要素で1回呼ばれる
    expect(cb).toHaveBeenCalledTimes(1);

    // 同じ要素を再度追加しても呼ばれない（WeakSetで管理）
    // ただし新しい要素は呼ばれる
    const newEl = document.createElement("div");
    newEl.className = "dup";
    document.body.appendChild(newEl);

    await new Promise((r) => setTimeout(r, 0));

    expect(cb).toHaveBeenCalledTimes(2);
    observer.disconnect();
  });

  it("ネストされた要素も検出する", async () => {
    const cb = vi.fn();
    const observer = observeDOM(".nested", cb);

    const wrapper = document.createElement("div");
    wrapper.innerHTML = '<span class="nested">inner</span>';
    document.body.appendChild(wrapper);

    await new Promise((r) => setTimeout(r, 0));

    expect(cb).toHaveBeenCalledTimes(1);
    observer.disconnect();
  });

  it("disconnectした後は検出しない", async () => {
    const cb = vi.fn();
    const observer = observeDOM(".after-disconnect", cb);
    observer.disconnect();

    const el = document.createElement("div");
    el.className = "after-disconnect";
    document.body.appendChild(el);

    await new Promise((r) => setTimeout(r, 0));

    expect(cb).toHaveBeenCalledTimes(0);
  });
});

describe("observeActionNavs", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function li(icon: string, label: string): HTMLElement {
    const el = document.createElement("li");
    el.innerHTML = `<button class="actionButton"><span class="iconContainer"><svg><use href="#${icon}"></use></svg></span><span class="actionLabel">${label}</span></button>`;
    return el;
  }

  // ページを開いて最初のホバーと同じく、空のメニューが先に入り、項目が後から入る
  async function addEmptyNavThenItems(): Promise<Element> {
    const nav = document.createElement("ul");
    nav.className = "messageActionNav";
    document.body.appendChild(nav);
    await new Promise((r) => setTimeout(r, 0));
    nav.append(li("icon_reply", "返信"), li("icon_task", "タスク"), li("icon_link", "リンク"));
    await new Promise((r) => setTimeout(r, 0));
    return nav;
  }

  it("項目が後から入ったときにも呼ぶ", async () => {
    const cb = vi.fn();
    const observer = observeActionNavs(cb);
    const nav = await addEmptyNavThenItems();
    observer.disconnect();

    expect(cb).toHaveBeenCalledWith(nav);
    expect(cb.mock.calls.at(-1)?.[0]).toBe(nav);
    expect(nav.children).toHaveLength(3);
  });

  it("最初のホバーでもmyボタンが付く（2回呼ばれても1つだけ）", async () => {
    const observer = observeActionNavs(injectMyTaskButton);
    const nav = await addEmptyNavThenItems();
    injectMyTaskButton(nav);
    observer.disconnect();

    const labels = Array.from(nav.children).map((el) => el.textContent?.trim());
    expect(labels).toEqual(["返信", "タスク", "my", "リンク"]);
  });
});
