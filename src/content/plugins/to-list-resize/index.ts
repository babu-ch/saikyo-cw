import type { CwPlugin } from "../types";
import { CW } from "../../../shared/chatwork-selectors";
import { observeDOM } from "../../../shared/mutation-observer";
import { getPluginConfig, setPluginConfig } from "../../../shared/storage";

const PLUGIN_ID = "to-list-resize";
const STYLE_ID = "scw-to-list-resize-style";
const HEIGHT_STYLE_ID = "scw-to-list-resize-height";
const HANDLE_CLASS = "scw-to-list-resize__handle";
/** CW純正のメンバー一覧の高さ。これより低くはしない */
export const DEFAULT_HEIGHT = 160;
/** 画面の上端との間に残す余白 */
const TOP_MARGIN = 8;

export interface ToListResizeConfig {
  /** メンバー一覧の高さ(px)。未設定ならCW純正のまま */
  height?: number;
  /** 一覧以外に要る高さ(px)。画面が低いときに一覧を縮めて画面内に収めるのに使う */
  reserved?: number;
}

let observer: MutationObserver | null = null;
let enabled = false;

const STYLES = `
  .${HANDLE_CLASS} {
    height: 10px;
    margin: -4px 0 2px;
    cursor: ns-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }
  .${HANDLE_CLASS}::before {
    content: "";
    width: 32px;
    height: 3px;
    border-radius: 2px;
    background-color: rgba(127, 127, 127, 0.35);
  }
  .${HANDLE_CLASS}:hover::before {
    background-color: rgba(127, 127, 127, 0.7);
  }
`;

// CWは開くときに一覧の高さを測って上に位置を決めるので、CSSで高さを変えれば下端（TOボタンの上）はずれない
export function buildHeightCss(height: number, reserved: number): string {
  const value = `min(${height}px, max(${DEFAULT_HEIGHT}px, calc(100vh - ${reserved}px)))`;
  return `${CW.TO_LIST} ${CW.TO_LIST_ITEMS} {\n  height: ${value} !important;\n  max-height: ${value} !important;\n}`;
}

function setStyle(id: string, css: string | null): void {
  let style = document.getElementById(id);
  if (css === null) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

function applyHeight(config: ToListResizeConfig): void {
  setStyle(
    HEIGHT_STYLE_ID,
    config.height ? buildHeightCss(config.height, config.reserved ?? 0) : null,
  );
}

export function clampHeight(height: number, max: number): number {
  return Math.round(Math.min(Math.max(height, DEFAULT_HEIGHT), Math.max(max, DEFAULT_HEIGHT)));
}

// 一覧はTOボタンの上に開くので、上端をつまんで上に引くと広がる
function startDrag(e: PointerEvent, list: HTMLElement, handle: HTMLElement): void {
  const items = list.querySelector<HTMLElement>(CW.TO_LIST_ITEMS);
  if (!items) return;
  e.preventDefault();
  e.stopPropagation();

  const startY = e.clientY;
  const startHeight = items.getBoundingClientRect().height;
  const startTop = parseFloat(list.style.top) || list.offsetTop;
  const listRect = list.getBoundingClientRect();
  const maxHeight = startHeight + listRect.top - TOP_MARGIN;
  // 一覧の下端から画面下端までと、検索欄・フッターなど一覧以外の高さ
  const reserved = Math.round(window.innerHeight - listRect.bottom + (listRect.height - startHeight) + TOP_MARGIN);
  let height = startHeight;

  const onMove = (ev: PointerEvent): void => {
    height = clampHeight(startHeight + (startY - ev.clientY), maxHeight);
    setStyle(HEIGHT_STYLE_ID, buildHeightCss(height, reserved));
    list.style.top = `${startTop - (height - startHeight)}px`;
  };
  const onUp = (): void => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
    // つまみをクリックしただけ（高さが変わっていない）なら保存しない
    if (height !== startHeight) void setPluginConfig(PLUGIN_ID, { height, reserved });
  };

  handle.setPointerCapture?.(e.pointerId);
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}

// ダブルクリックでCW純正の高さに戻す
function resetHeight(list: HTMLElement): void {
  const items = list.querySelector<HTMLElement>(CW.TO_LIST_ITEMS);
  const currentHeight = items?.getBoundingClientRect().height ?? DEFAULT_HEIGHT;
  setStyle(HEIGHT_STYLE_ID, null);
  const top = parseFloat(list.style.top);
  if (!Number.isNaN(top)) {
    list.style.top = `${top + (currentHeight - DEFAULT_HEIGHT)}px`;
  }
  void setPluginConfig(PLUGIN_ID, {});
}

export function injectHandle(list: Element): void {
  if (!enabled || list.querySelector(`.${HANDLE_CLASS}`)) return;
  const listEl = list as HTMLElement;
  const handle = document.createElement("div");
  handle.className = HANDLE_CLASS;
  handle.title = "ドラッグで高さを変える（ダブルクリックで元に戻す）";
  handle.addEventListener("pointerdown", (e) => startDrag(e, listEl, handle));
  handle.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetHeight(listEl);
  });

  const searchArea = list.querySelector(CW.TO_LIST_SEARCH_AREA);
  if (searchArea) {
    searchArea.insertAdjacentElement("beforebegin", handle);
  } else {
    list.prepend(handle);
  }
}

export const toListResizePlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "TO一覧の高さ調整",
    description: "TOのメンバー一覧の上端をドラッグして縦に広げる。広げた高さは次から覚えておく",
    defaultEnabled: true,
  },
  init() {
    enabled = true;
    setStyle(STYLE_ID, STYLES);
    void getPluginConfig<ToListResizeConfig>(PLUGIN_ID).then((config) => {
      if (!enabled) return;
      applyHeight(config ?? {});
    });
    observer = observeDOM(CW.TO_LIST, injectHandle);
  },
  destroy() {
    enabled = false;
    observer?.disconnect();
    observer = null;
    setStyle(STYLE_ID, null);
    setStyle(HEIGHT_STYLE_ID, null);
    document.querySelectorAll(`.${HANDLE_CLASS}`).forEach((el) => el.remove());
  },
};
