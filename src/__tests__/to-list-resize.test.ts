import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStore } from "./setup";
import {
  buildHeightCss,
  clampHeight,
  DEFAULT_HEIGHT,
  toListResizePlugin,
} from "../content/plugins/to-list-resize";
import { getPluginConfig, setPluginConfig } from "../shared/storage";

const HANDLE = ".scw-to-list-resize__handle";
const HEIGHT_STYLE = "scw-to-list-resize-height";

function setupToList(): HTMLElement {
  document.body.innerHTML = `
    <div id="_toList" class="toSelectorTooltip tooltip" style="top: 500px;">
      <div class="_cwTTTriangle"></div>
      <div class="_cwLTSearchArea"><input></div>
      <ul class="_cwLTList" style="height: 160px; max-height: 160px;"><li>テスト太郎</li></ul>
      <div id="_toListFooter"></div>
    </div>
  `;
  return document.getElementById("_toList")!;
}

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe("buildHeightCss / clampHeight", () => {
  it("一覧の高さを指定し、画面が低いときは画面内に収める", () => {
    const css = buildHeightCss(400, 300);
    expect(css).toContain("#_toList ._cwLTList");
    expect(css).toContain("min(400px, max(160px, calc(100vh - 300px))) !important");
  });

  it("純正の高さより低くはせず、上限を超えない", () => {
    expect(clampHeight(100, 500)).toBe(DEFAULT_HEIGHT);
    expect(clampHeight(320.4, 500)).toBe(320);
    expect(clampHeight(800, 500)).toBe(500);
  });
});

describe("toListResizePlugin", () => {
  beforeEach(() => {
    resetStore();
    document.head.innerHTML = "";
  });

  afterEach(() => {
    toListResizePlugin.destroy();
    vi.restoreAllMocks();
  });

  it("検索欄の上につまみを1つだけ追加する", async () => {
    const list = setupToList();
    toListResizePlugin.init();
    await flush();

    expect(list.querySelectorAll(HANDLE)).toHaveLength(1);
    expect(list.querySelector(HANDLE)?.nextElementSibling?.className).toBe("_cwLTSearchArea");
  });

  it("保存済みの高さをスタイルとして注入し、destroyで外す", async () => {
    await setPluginConfig("to-list-resize", { height: 400, reserved: 250 });
    const list = setupToList();
    toListResizePlugin.init();
    await flush();
    expect(document.getElementById(HEIGHT_STYLE)?.textContent).toContain("min(400px");

    toListResizePlugin.destroy();
    expect(document.getElementById(HEIGHT_STYLE)).toBeNull();
    expect(list.querySelector(HANDLE)).toBeNull();
  });

  it("上に引くと広がり、一覧の位置も同じだけ上がり、高さを保存する", async () => {
    const list = setupToList();
    toListResizePlugin.init();
    await flush();

    const items = list.querySelector("._cwLTList")!;
    vi.spyOn(items, "getBoundingClientRect").mockReturnValue(rect(600, 160));
    vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(500, 264));
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(900);

    const handle = list.querySelector(HANDLE)!;
    handle.dispatchEvent(new MouseEvent("pointerdown", { clientY: 600, bubbles: true }));
    handle.dispatchEvent(new MouseEvent("pointermove", { clientY: 400, bubbles: true }));
    expect(list.style.top).toBe("300px");
    expect(document.getElementById(HEIGHT_STYLE)?.textContent).toContain("min(360px");

    handle.dispatchEvent(new MouseEvent("pointerup", { clientY: 400, bubbles: true }));
    await flush();
    // 画面下端まで136 + 一覧以外の高さ104 + 余白8
    expect(await getPluginConfig("to-list-resize")).toEqual({ height: 360, reserved: 248 });
  });

  it("ダブルクリックで純正の高さに戻す", async () => {
    await setPluginConfig("to-list-resize", { height: 400, reserved: 250 });
    const list = setupToList();
    toListResizePlugin.init();
    await flush();

    vi.spyOn(list.querySelector("._cwLTList")!, "getBoundingClientRect").mockReturnValue(rect(260, 400));
    list.querySelector(HANDLE)!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    await flush();

    expect(document.getElementById(HEIGHT_STYLE)).toBeNull();
    expect(list.style.top).toBe("740px");
    expect(await getPluginConfig("to-list-resize")).toEqual({});
  });
});
