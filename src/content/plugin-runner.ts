import type { CwPlugin } from "./plugins/types";
import { getPluginSettings, isPluginEnabled, storageKeyForPlugin } from "../shared/storage";
import { inputToolsPlugin } from "./plugins/input-tools";
import { muteButtonPlugin } from "./plugins/mute-button";
import { quickTaskPlugin } from "./plugins/quick-task";
import { mentionGroupPlugin } from "./plugins/mention-group";
import { reactionCopyPlugin } from "./plugins/reaction-copy";
import { hoverReactionPlugin } from "./plugins/hover-reaction";
import { mentionAutocompletePlugin } from "./plugins/mention-autocomplete";
import { forceSendButtonPlugin } from "./plugins/force-send-button";
import { vipNotifyPlugin } from "./plugins/vip-notify";
import { chatExportPlugin } from "./plugins/chat-export";
import { replyThreadPlugin } from "./plugins/reply-thread";
import { quickDeletePlugin } from "./plugins/quick-delete";
import { linkCopyPlugin } from "./plugins/link-copy";
import { actionMenuPlugin } from "./plugins/action-menu";
import { toListResizePlugin } from "./plugins/to-list-resize";

const ALL_PLUGINS: CwPlugin[] = [
  inputToolsPlugin,
  muteButtonPlugin,
  quickTaskPlugin,
  mentionGroupPlugin,
  reactionCopyPlugin,
  hoverReactionPlugin,
  mentionAutocompletePlugin,
  forceSendButtonPlugin,
  vipNotifyPlugin,
  chatExportPlugin,
  replyThreadPlugin,
  quickDeletePlugin,
  linkCopyPlugin,
  actionMenuPlugin,
  toListResizePlugin,
];

const activePlugins = new Map<string, CwPlugin>();

export async function startPlugins(): Promise<void> {
  const settings = await getPluginSettings();

  for (const plugin of ALL_PLUGINS) {
    if (isPluginEnabled(plugin.config, settings[plugin.config.id])) {
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
      const nowEnabled = isPluginEnabled(plugin.config, change.newValue);

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
