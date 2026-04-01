import type { CwPlugin } from "./plugins/types";
import { getPluginSettings, storageKeyForPlugin } from "../shared/storage";
import { inputToolsPlugin } from "./plugins/input-tools";
import { muteButtonPlugin } from "./plugins/mute-button";
import { quickTaskPlugin } from "./plugins/quick-task";
import { mentionGroupPlugin } from "./plugins/mention-group";

const ALL_PLUGINS: CwPlugin[] = [
  inputToolsPlugin,
  muteButtonPlugin,
  quickTaskPlugin,
  mentionGroupPlugin,
];

const activePlugins = new Map<string, CwPlugin>();

export async function startPlugins(): Promise<void> {
  const settings = await getPluginSettings();

  for (const plugin of ALL_PLUGINS) {
    const enabled = settings[plugin.config.id]?.enabled ?? true;
    if (enabled) {
      plugin.init();
      activePlugins.set(plugin.config.id, plugin);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const plugin of ALL_PLUGINS) {
      const key = storageKeyForPlugin(plugin.config.id);
      const change = changes[key];
      if (!change) continue;

      const wasEnabled = activePlugins.has(plugin.config.id);
      const nowEnabled = change.newValue?.enabled ?? true;

      if (wasEnabled && !nowEnabled) {
        plugin.destroy();
        activePlugins.delete(plugin.config.id);
      } else if (!wasEnabled && nowEnabled) {
        plugin.init();
        activePlugins.set(plugin.config.id, plugin);
      }
    }
  });
}
