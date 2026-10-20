import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetStore } from "./setup";
import { buildHideCss, hideChatworkAiPlugin } from "../content/plugins/hide-chatwork-ai";
import { CW } from "../shared/chatwork-selectors";
import { setPluginConfig, storageKeyForPlugin } from "../shared/storage";

const STYLE_ID = "scw-hide-chatwork-ai-style";

function setupChatwork(): void {
  document.body.innerHTML = `
    <div data-testid="message-input-area">
      <ul>
        <div class="_showDescription" data-tooltip="絵文字"><div><button aria-label="絵文字"><svg><use href="#icon_emoticon"></use></svg></button></div></div>
        <div class="_showDescription" data-tooltip="Chatwork AI"><div><button aria-label="Chatwork AI"><svg><use href="#icon_sparklesMono"></use></svg></button></div></div>
      </ul>
    </div>
    <div id="_subContentAreaContent">
      <div id="_subAiArea"><section id="_aiPanelPane" aria-label="Chatwork AI"></section></div>
      <div id="_subRoomInfoArea"></div>
    </div>
  `;
}

function styleText(): string | null {
  return document.getElementById(STYLE_ID)?.textContent ?? null;
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe("buildHideCss", () => {
  it("初期設定では右の欄と入力欄のボタンの両方を隠す", () => {
    const css = buildHideCss({});
    expect(css).toContain(CW.AI_PANEL);
    expect(css).toContain(CW.AI_INPUT_BUTTON);
    expect(css).toContain("display: none !important");
  });

  it("残す設定にした場所は隠さない", () => {
    const css = buildHideCss({ keepPanel: true });
    expect(css).not.toContain(CW.AI_PANEL);
    expect(css).toContain(CW.AI_INPUT_BUTTON);
  });

  it("両方残すならCSSを出さない", () => {
    expect(buildHideCss({ keepPanel: true, keepInputButton: true })).toBe("");
  });

  it("セレクタは右の欄と入力欄のChatwork AIボタンのwrapperだけに当たる", () => {
    setupChatwork();
    expect([...document.querySelectorAll(CW.AI_PANEL)].map((el) => el.id)).toEqual(["_subAiArea"]);
    const buttons = [...document.querySelectorAll(CW.AI_INPUT_BUTTON)];
    expect(buttons.map((el) => el.getAttribute("data-tooltip"))).toEqual(["Chatwork AI"]);
  });
});

describe("hideChatworkAiPlugin", () => {
  beforeEach(() => {
    resetStore();
    document.head.innerHTML = "";
    setupChatwork();
  });

  afterEach(() => {
    hideChatworkAiPlugin.destroy();
  });

  it("有効にすると設定を読む前から両方隠す", () => {
    hideChatworkAiPlugin.init();
    expect(styleText()).toBe(buildHideCss({}));
  });

  it("保存済みの設定を読み込んで反映する", async () => {
    await setPluginConfig("hide-chatwork-ai", { keepInputButton: true });
    hideChatworkAiPlugin.init();
    await flush();
    expect(styleText()).toBe(buildHideCss({ keepInputButton: true }));
  });

  it("設定を変えるとその場で反映する", async () => {
    hideChatworkAiPlugin.init();
    await flush();
    await setPluginConfig("hide-chatwork-ai", { keepPanel: true });
    expect(styleText()).toBe(buildHideCss({ keepPanel: true }));
  });

  it("両方残す設定にするとスタイルを外す", async () => {
    hideChatworkAiPlugin.init();
    await flush();
    await setPluginConfig("hide-chatwork-ai", { keepPanel: true, keepInputButton: true });
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it("設定が消えたら両方隠す状態に戻す", async () => {
    await setPluginConfig("hide-chatwork-ai", { keepPanel: true });
    hideChatworkAiPlugin.init();
    await flush();
    await chrome.storage.sync.set({ [storageKeyForPlugin("hide-chatwork-ai")]: { enabled: true } });
    expect(styleText()).toBe(buildHideCss({}));
  });

  it("設定の読み込み中に無効にしたら、あとから届いた設定でスタイルを戻さない", async () => {
    await setPluginConfig("hide-chatwork-ai", { keepPanel: true });
    hideChatworkAiPlugin.init();
    hideChatworkAiPlugin.destroy();
    await flush();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });

  it("無効にしてすぐ有効にしたら、前の読み込み結果が遅れて届いても使わない", async () => {
    await setPluginConfig("hide-chatwork-ai", { keepInputButton: true });
    const key = storageKeyForPlugin("hide-chatwork-ai");
    vi.mocked(chrome.storage.sync.get).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ [key]: { enabled: true, config: { keepPanel: true } } }), 20),
        ),
    );
    hideChatworkAiPlugin.init();
    hideChatworkAiPlugin.destroy();
    hideChatworkAiPlugin.init();
    await new Promise((r) => setTimeout(r, 40));
    expect(styleText()).toBe(buildHideCss({ keepInputButton: true }));
    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
  });

  it("無効にするとスタイルを外す", async () => {
    hideChatworkAiPlugin.init();
    await flush();
    hideChatworkAiPlugin.destroy();
    expect(document.getElementById(STYLE_ID)).toBeNull();
  });
});
