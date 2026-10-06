import { describe, it, expect, afterEach } from "vitest";
import { hideUntilClosed } from "../shared/cw-popups";

async function flush(ms = 0): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

describe("hideUntilClosed", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("ポップアップの箱を隠し、中身が消えたら箱が残っていても元に戻す", async () => {
    document.body.innerHTML = `<div id="_wrapper"><div class="box"><div><ul class="menu"></ul></div></div></div>`;
    const box = document.querySelector<HTMLElement>(".box")!;
    const menu = document.querySelector(".menu")!;

    hideUntilClosed(menu);
    expect(box.style.visibility).toBe("hidden");

    menu.remove();
    await flush();
    expect(box.style.visibility).toBe("");
  });

  it("タイムライン（メッセージ）を含む要素は隠さない", () => {
    document.body.innerHTML = `<div id="_wrapper"><div class="layout"><div id="_messageId1"><ul class="messageActionNav"></ul></div></div></div>`;
    hideUntilClosed(document.querySelector(".messageActionNav")!);
    expect(document.querySelector<HTMLElement>(".layout")!.style.visibility).toBe("");
  });
});
