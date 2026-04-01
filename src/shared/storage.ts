export interface PluginSettings {
  enabled: boolean;
  apiKey?: string;
  config?: Record<string, unknown>;
}

const PLUGIN_PREFIX = "plugin_";

export async function getPluginSettings(): Promise<
  Record<string, PluginSettings>
> {
  const all = await chrome.storage.sync.get(null);
  const result: Record<string, PluginSettings> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith(PLUGIN_PREFIX)) {
      result[key.replace(PLUGIN_PREFIX, "")] = value as PluginSettings;
    }
  }
  return result;
}

export async function getPluginSetting(
  pluginId: string,
): Promise<PluginSettings | undefined> {
  const key = `${PLUGIN_PREFIX}${pluginId}`;
  const data = await chrome.storage.sync.get(key);
  return data[key] as PluginSettings | undefined;
}

export async function setPluginEnabled(
  pluginId: string,
  enabled: boolean,
): Promise<void> {
  const key = `${PLUGIN_PREFIX}${pluginId}`;
  const current = ((await chrome.storage.sync.get(key))[key] as PluginSettings) ?? {};
  await chrome.storage.sync.set({ [key]: { ...current, enabled } });
}

export async function setPluginApiKey(
  pluginId: string,
  apiKey: string,
): Promise<void> {
  const key = `${PLUGIN_PREFIX}${pluginId}`;
  const current = ((await chrome.storage.sync.get(key))[key] as PluginSettings) ?? {};
  await chrome.storage.sync.set({ [key]: { ...current, apiKey } });
}

export async function getPluginConfig<T>(
  pluginId: string,
): Promise<T | undefined> {
  const key = `${PLUGIN_PREFIX}${pluginId}`;
  const data = await chrome.storage.sync.get(key);
  return (data[key] as PluginSettings)?.config as T | undefined;
}

export async function setPluginConfig(
  pluginId: string,
  config: Record<string, unknown>,
): Promise<void> {
  const key = `${PLUGIN_PREFIX}${pluginId}`;
  const current = ((await chrome.storage.sync.get(key))[key] as PluginSettings) ?? {};
  await chrome.storage.sync.set({ [key]: { ...current, config } });
}

export function storageKeyForPlugin(pluginId: string): string {
  return `${PLUGIN_PREFIX}${pluginId}`;
}
