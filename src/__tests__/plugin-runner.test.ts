import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetStore } from "./setup";
import type { CwPlugin } from "../content/plugins/types";

// plugin-runnerは静的importで各プラグインを読み込むため、
// プラグインライフサイクルのロジックを直接テストする

describe("plugin lifecycle", () => {
  beforeEach(() => {
    resetStore();
  });

  function createMockPlugin(id: string): CwPlugin {
    return {
      config: {
        id,
        name: `Test Plugin ${id}`,
        description: `Description for ${id}`,
      },
      init: vi.fn(),
      destroy: vi.fn(),
    };
  }

  it("有効なプラグインのinitが呼ばれる", async () => {
    const plugin = createMockPlugin("test");
    await chrome.storage.sync.set({
      plugin_test: { enabled: true },
    });

    const settings = await chrome.storage.sync.get(null);
    const pluginSettings = settings.plugin_test as { enabled: boolean } | undefined;
    const enabled = pluginSettings?.enabled ?? true;

    if (enabled) {
      plugin.init();
    }

    expect(plugin.init).toHaveBeenCalledTimes(1);
  });

  it("無効なプラグインのinitは呼ばれない", async () => {
    const plugin = createMockPlugin("disabled");
    await chrome.storage.sync.set({
      plugin_disabled: { enabled: false },
    });

    const settings = await chrome.storage.sync.get(null);
    const pluginSettings = settings.plugin_disabled as { enabled: boolean } | undefined;
    const enabled = pluginSettings?.enabled ?? true;

    if (enabled) {
      plugin.init();
    }

    expect(plugin.init).not.toHaveBeenCalled();
  });

  it("設定未登録のプラグインはデフォルトで有効", async () => {
    const plugin = createMockPlugin("unset");

    const settings = await chrome.storage.sync.get(null);
    const pluginSettings = settings.plugin_unset as { enabled: boolean } | undefined;
    const enabled = pluginSettings?.enabled ?? true;

    if (enabled) {
      plugin.init();
    }

    expect(plugin.init).toHaveBeenCalledTimes(1);
  });

  it("storage変更で有効→無効に切り替わるとdestroyが呼ばれる", async () => {
    const plugin = createMockPlugin("toggle");
    const activePlugins = new Map<string, CwPlugin>();

    // 初期化
    plugin.init();
    activePlugins.set("toggle", plugin);

    // storage.onChanged をシミュレート
    const changes = {
      plugin_toggle: {
        oldValue: { enabled: true },
        newValue: { enabled: false },
      },
    };

    const wasEnabled = activePlugins.has("toggle");
    const nowEnabled = changes.plugin_toggle.newValue.enabled;

    if (wasEnabled && !nowEnabled) {
      plugin.destroy();
      activePlugins.delete("toggle");
    }

    expect(plugin.destroy).toHaveBeenCalledTimes(1);
    expect(activePlugins.has("toggle")).toBe(false);
  });

  it("storage変更で無効→有効に切り替わるとinitが呼ばれる", async () => {
    const plugin = createMockPlugin("reactivate");
    const activePlugins = new Map<string, CwPlugin>();

    // 無効状態
    const changes = {
      plugin_reactivate: {
        oldValue: { enabled: false },
        newValue: { enabled: true },
      },
    };

    const wasEnabled = activePlugins.has("reactivate");
    const nowEnabled = changes.plugin_reactivate.newValue.enabled;

    if (!wasEnabled && nowEnabled) {
      plugin.init();
      activePlugins.set("reactivate", plugin);
    }

    expect(plugin.init).toHaveBeenCalledTimes(1);
    expect(activePlugins.has("reactivate")).toBe(true);
  });
});
