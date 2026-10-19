import type { CwPlugin } from "../types";
import { CW } from "../../../shared/chatwork-selectors";
import {
  getPluginConfig,
  storageKeyForPlugin,
  type PluginSettings,
} from "../../../shared/storage";

const PLUGIN_ID = "hide-chatwork-ai";
const STYLE_ID = "scw-hide-chatwork-ai-style";

export interface HideChatworkAiConfig {
  /** 右の欄の「Chatwork AI」を隠さずに残す */
  keepPanel?: boolean;
  /** 入力欄の「Chatwork AI」ボタンを隠さずに残す */
  keepInputButton?: boolean;
}

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

let enabled = false;
// 設定の読み込み中にdestroy→initされたとき、古い読み込み結果を捨てるための世代
let generation = 0;
let onStorageChanged: StorageListener | null = null;

// CWが描画し直しても効くように、要素を消さずにCSSで隠す
export function buildHideCss(config: HideChatworkAiConfig): string {
  const selectors: string[] = [];
  if (!config.keepPanel) selectors.push(CW.AI_PANEL);
  if (!config.keepInputButton) selectors.push(CW.AI_INPUT_BUTTON);
  if (selectors.length === 0) return "";
  return `${selectors.join(",\n")} {\n  display: none !important;\n}`;
}

function applyConfig(config: HideChatworkAiConfig): void {
  const css = buildHideCss(config);
  let style = document.getElementById(STYLE_ID);
  if (!css) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

export const hideChatworkAiPlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "Chatwork AIを隠す",
    description: "右の欄の「Chatwork AI」と入力欄の「Chatwork AI」ボタンを隠す",
    defaultEnabled: false,
  },
  init() {
    enabled = true;
    const current = ++generation;
    // 設定を読む前から隠しておき、一瞬表示されるのを防ぐ
    applyConfig({});
    void getPluginConfig<HideChatworkAiConfig>(PLUGIN_ID).then((loaded) => {
      if (!enabled || current !== generation) return;
      applyConfig(loaded ?? {});
    });

    onStorageChanged = (changes, area) => {
      if (!enabled || area !== "sync") return;
      const change = changes[storageKeyForPlugin(PLUGIN_ID)];
      if (!change) return;
      const next = (change.newValue as PluginSettings | undefined)?.config as
        | HideChatworkAiConfig
        | undefined;
      applyConfig(next ?? {});
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
  },
  destroy() {
    enabled = false;
    generation++;
    if (onStorageChanged) {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      onStorageChanged = null;
    }
    document.getElementById(STYLE_ID)?.remove();
  },
};
