import { describe, it, expect, beforeEach } from "vitest";
import { resetStore } from "./setup";
import {
  getPluginSettings,
  getPluginSetting,
  setPluginEnabled,
  setPluginApiKey,
  getPluginConfig,
  setPluginConfig,
  storageKeyForPlugin,
} from "../shared/storage";

describe("storage", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("storageKeyForPlugin", () => {
    it("plugin_プレフィックスを付与する", () => {
      expect(storageKeyForPlugin("mute-button")).toBe("plugin_mute-button");
    });
  });

  describe("getPluginSettings", () => {
    it("空のstoreでは空オブジェクトを返す", async () => {
      const settings = await getPluginSettings();
      expect(settings).toEqual({});
    });

    it("plugin_プレフィックスのキーのみ取得する", async () => {
      await chrome.storage.sync.set({
        plugin_foo: { enabled: true },
        plugin_bar: { enabled: false },
        unrelated_key: { value: 123 },
      });

      const settings = await getPluginSettings();
      expect(settings).toEqual({
        foo: { enabled: true },
        bar: { enabled: false },
      });
      expect(settings).not.toHaveProperty("unrelated_key");
    });
  });

  describe("getPluginSetting", () => {
    it("存在するプラグインの設定を取得できる", async () => {
      await chrome.storage.sync.set({
        plugin_test: { enabled: true, apiKey: "key123" },
      });

      const setting = await getPluginSetting("test");
      expect(setting).toEqual({ enabled: true, apiKey: "key123" });
    });

    it("存在しないプラグインはundefinedを返す", async () => {
      const setting = await getPluginSetting("nonexistent");
      expect(setting).toBeUndefined();
    });
  });

  describe("setPluginEnabled", () => {
    it("新規プラグインの有効状態を設定できる", async () => {
      await setPluginEnabled("test", true);

      const data = await chrome.storage.sync.get("plugin_test");
      expect(data.plugin_test).toEqual({ enabled: true });
    });

    it("既存設定を保持しつつenabledを更新できる", async () => {
      await chrome.storage.sync.set({
        plugin_test: { enabled: true, apiKey: "mykey" },
      });

      await setPluginEnabled("test", false);

      const data = await chrome.storage.sync.get("plugin_test");
      expect(data.plugin_test).toEqual({ enabled: false, apiKey: "mykey" });
    });
  });

  describe("setPluginApiKey", () => {
    it("APIキーを保存できる", async () => {
      await setPluginApiKey("test", "secret-key");

      const data = await chrome.storage.sync.get("plugin_test");
      expect(data.plugin_test).toEqual({ apiKey: "secret-key" });
    });

    it("既存設定を保持しつつAPIキーを更新できる", async () => {
      await chrome.storage.sync.set({
        plugin_test: { enabled: true },
      });

      await setPluginApiKey("test", "new-key");

      const data = await chrome.storage.sync.get("plugin_test");
      expect(data.plugin_test).toEqual({ enabled: true, apiKey: "new-key" });
    });
  });

  describe("getPluginConfig / setPluginConfig", () => {
    it("プラグイン固有設定を保存・取得できる", async () => {
      await setPluginConfig("test", { myChatId: "12345" });

      const config = await getPluginConfig<{ myChatId: string }>("test");
      expect(config).toEqual({ myChatId: "12345" });
    });

    it("設定が未登録ならundefinedを返す", async () => {
      const config = await getPluginConfig("nonexistent");
      expect(config).toBeUndefined();
    });
  });
});
