import { describe, it, expect, vi, afterEach } from "vitest";
import { observeDOM } from "../shared/mutation-observer";

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
