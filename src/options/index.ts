import { PLUGIN_CONFIGS } from "../shared/plugin-configs";
import {
  getPluginSettings,
  setPluginEnabled,
  setPluginApiKey,
  type PluginSettings,
} from "../shared/storage";

let statusTimeout: ReturnType<typeof setTimeout> | null = null;

function showStatus(message: string): void {
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = message;
  el.style.opacity = "1";
  if (statusTimeout) clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => {
    el.style.opacity = "0";
  }, 2000);
}

function createPluginCard(
  config: (typeof PLUGIN_CONFIGS)[number],
  settings: PluginSettings | undefined,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "plugin-card";

  const enabled = settings?.enabled ?? true;

  card.innerHTML = `
    <div class="plugin-info">
      <div class="plugin-name">${config.name}</div>
      <div class="plugin-description">${config.description}</div>
      ${
        config.requiresApiKey
          ? `
        <div class="plugin-config">
          <label class="api-key-label">${config.apiKeyLabel ?? "API Key"}</label>
          <input type="password" class="api-key-input"
                 placeholder="APIキーを入力"
                 value="${settings?.apiKey ?? ""}"
                 data-plugin-id="${config.id}">
        </div>
      `
          : ""
      }
    </div>
    <label class="toggle">
      <input type="checkbox" ${enabled ? "checked" : ""} data-plugin-id="${config.id}">
      <span class="toggle-slider"></span>
    </label>
  `;

  // Toggle handler
  const checkbox = card.querySelector<HTMLInputElement>(
    '.toggle input[type="checkbox"]',
  )!;
  checkbox.addEventListener("change", async () => {
    await setPluginEnabled(config.id, checkbox.checked);
    showStatus(`${config.name} を${checkbox.checked ? "有効" : "無効"}にしました`);
  });

  // API key handler
  if (config.requiresApiKey) {
    const apiKeyInput = card.querySelector<HTMLInputElement>(".api-key-input")!;
    let debounce: ReturnType<typeof setTimeout>;
    apiKeyInput.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        await setPluginApiKey(config.id, apiKeyInput.value);
        showStatus("APIキーを保存しました");
      }, 500);
    });
  }

  return card;
}

async function render(): Promise<void> {
  const container = document.getElementById("plugin-list");
  if (!container) return;

  const settings = await getPluginSettings();

  for (const config of PLUGIN_CONFIGS) {
    const card = createPluginCard(config, settings[config.id]);
    container.appendChild(card);
  }
}

render();
