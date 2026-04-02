import { PLUGIN_CONFIGS } from "../shared/plugin-configs";
import {
  ALL_BUTTON_METAS,
  getDefaultEnabledIds,
} from "../shared/input-tools-buttons";
import {
  getPluginSettings,
  getPluginConfig,
  setPluginEnabled,
  setPluginApiKey,
  setPluginConfig,
  getApiToken,
  setApiToken,
  type PluginSettings,
} from "../shared/storage";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

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

  const checkbox = card.querySelector<HTMLInputElement>(
    '.toggle input[type="checkbox"]',
  )!;
  checkbox.addEventListener("change", async () => {
    await setPluginEnabled(config.id, checkbox.checked);
    showStatus(`${config.name} を${checkbox.checked ? "有効" : "無効"}にしました`);
  });

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

async function createInputToolsConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{ enabledButtons?: string[] }>(
    "input-tools",
  );
  const enabledIds = new Set(
    config?.enabledButtons ?? getDefaultEnabledIds(),
  );

  section.innerHTML = `
    <div class="button-config" style="margin-top: 8px;"></div>
  `;

  const container = section.querySelector(".button-config")!;

  for (const meta of ALL_BUTTON_METAS) {
    const label = document.createElement("label");
    label.className = "button-config-item";

    const typeLabel =
      meta.type === "tag" ? "タグ" : meta.type === "emo" ? "絵文字" : "アクション";

    label.innerHTML = `
      <input type="checkbox" ${enabledIds.has(meta.id) ? "checked" : ""} data-button-id="${meta.id}">
      <span class="button-config-label">${meta.label}</span>
      <span class="button-config-desc">${meta.description}</span>
      <span class="button-config-type">${typeLabel}</span>
    `;

    const cb = label.querySelector<HTMLInputElement>("input")!;
    cb.addEventListener("change", async () => {
      if (cb.checked) {
        enabledIds.add(meta.id);
      } else {
        enabledIds.delete(meta.id);
      }
      await setPluginConfig("input-tools", {
        enabledButtons: Array.from(enabledIds),
      });
      showStatus("ボタン設定を保存しました");
    });

    container.appendChild(label);
  }

  return section;
}

async function createQuickTaskConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{ mode?: string; myChatId?: string }>(
    "quick-task",
  );
  const currentMode = config?.mode ?? "mychat-url";
  const currentChatId = config?.myChatId ?? "";

  const modes = [
    { value: "mychat-url", label: "マイチャットにURLのみ" },
    { value: "mychat-message", label: "マイチャットにURL+メッセージ" },
    { value: "here-url", label: "現チャットにURLのみ (担当者=自分)" },
    { value: "here-message", label: "現チャットにURL+メッセージ (担当者=自分)" },
  ];

  section.innerHTML = `
    <div style="margin-top: 8px;">
      <label class="api-key-label">動作モード</label>
      <select id="scw-task-mode" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; margin-top: 4px;">
        ${modes.map((m) => `<option value="${m.value}" ${m.value === currentMode ? "selected" : ""}>${m.label}</option>`).join("")}
      </select>
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">マイチャットのルームID</label>
      <input type="text" id="scw-task-chatid" class="api-key-input"
             placeholder="例: 12345678"
             value="${currentChatId}">
    </div>
  `;

  section.querySelector("#scw-task-mode")!.addEventListener("change", async (e) => {
    const mode = (e.target as HTMLSelectElement).value;
    const existing = (await getPluginConfig<Record<string, unknown>>("quick-task")) ?? {};
    await setPluginConfig("quick-task", { ...existing, mode });
    showStatus("Quick Taskモードを保存しました");
  });

  const chatIdInput = section.querySelector<HTMLInputElement>("#scw-task-chatid")!;
  let debounce: ReturnType<typeof setTimeout>;
  chatIdInput.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const existing = (await getPluginConfig<Record<string, unknown>>("quick-task")) ?? {};
      await setPluginConfig("quick-task", { ...existing, myChatId: chatIdInput.value });
      showStatus("マイチャットIDを保存しました");
    }, 500);
  });

  return section;
}

// ===== メンショングループ設定（元のpopup.js方式） =====
const MG_STORAGE_KEY = "quickMentionGroups";

interface MgMember {
  accountId: string;
  name: string;
}
interface MgGroup {
  name: string;
  members: MgMember[];
}

function parseMgMembers(text: string): MgMember[] {
  const members: MgMember[] = [];
  const lines = text.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    // 形式1: [To:12345678]田中太郎さん
    const toMatch = line.match(/\[To:(\d+)\]\s*(.+?)(?:さん)?$/);
    if (toMatch) {
      if (!members.some((m) => m.accountId === toMatch[1])) {
        members.push({ accountId: toMatch[1], name: toMatch[2].trim() });
      }
      continue;
    }
    // 形式2: 12345678,田中太郎 / 12345678 田中太郎
    const parts = line.split(/[,\t\s]+/);
    if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
      if (!members.some((m) => m.accountId === parts[0])) {
        members.push({ accountId: parts[0], name: parts.slice(1).join(" ").trim() });
      }
    }
  }
  return members;
}

function mgMembersToText(members: MgMember[]): string {
  return members.map((m) => `${m.accountId} ${m.name}`).join("\n");
}

async function createMentionGroupConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const data = await chrome.storage.sync.get(MG_STORAGE_KEY);
  const groups: MgGroup[] = data[MG_STORAGE_KEY] || [];

  section.innerHTML = `
    <div class="plugin-description" style="margin-top: 8px;">
      メンバーを1行ずつ入力（<code>accountId 名前</code> または <code>[To:accountId]名前さん</code> をコピペ）
    </div>
    <div id="scw-mg-group-list" style="margin-top: 12px;"></div>
    <div style="margin-top: 12px; display: flex; gap: 8px;">
      <button id="scw-mg-add" class="button-config-type" style="cursor: pointer; padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #f8f8f8;">+ グループ追加</button>
      <button id="scw-mg-save" class="button-config-type" style="cursor: pointer; padding: 6px 12px; border: none; border-radius: 6px; background: #4a9eff; color: white;">保存</button>
    </div>
    <div id="scw-mg-status" style="margin-top: 8px; font-size: 12px;"></div>
  `;

  const listEl = section.querySelector("#scw-mg-group-list")!;

  function createGroupCard(name = "", membersText = ""): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = "border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fafbfc;";
    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <input type="text" class="scw-mg-name api-key-input" placeholder="グループ名（例: 開発チーム）" value="${escapeHtml(name)}" style="flex: 1;">
        <button class="scw-mg-delete" style="border: none; background: none; color: #ccc; cursor: pointer; font-size: 18px; padding: 2px 6px;">&times;</button>
      </div>
      <textarea class="scw-mg-members api-key-input" placeholder="メンバーを1行ずつ入力&#10;例: 12345678 田中太郎&#10;または [To:12345678]田中太郎さん" style="width: 100%; min-height: 80px; font-family: monospace; font-size: 12px; line-height: 1.6; resize: vertical;">${escapeHtml(membersText)}</textarea>
      <div class="scw-mg-count" style="font-size: 11px; color: #888; margin-top: 4px; text-align: right;"></div>
    `;

    const textarea = card.querySelector<HTMLTextAreaElement>(".scw-mg-members")!;
    const countEl = card.querySelector(".scw-mg-count")!;
    const updateCount = () => {
      const count = parseMgMembers(textarea.value).length;
      countEl.textContent = count > 0 ? `${count}人` : "";
    };
    textarea.addEventListener("input", updateCount);
    updateCount();

    card.querySelector(".scw-mg-delete")!.addEventListener("click", () => {
      card.remove();
    });

    return card;
  }

  // 既存グループを表示
  if (groups.length === 0) {
    listEl.appendChild(createGroupCard());
  } else {
    for (const g of groups) {
      listEl.appendChild(createGroupCard(g.name, mgMembersToText(g.members)));
    }
  }

  section.querySelector("#scw-mg-add")!.addEventListener("click", () => {
    listEl.appendChild(createGroupCard());
  });

  section.querySelector("#scw-mg-save")!.addEventListener("click", () => {
    const cards = listEl.querySelectorAll<HTMLElement>("div[style]");
    const newGroups: MgGroup[] = [];
    cards.forEach((card) => {
      const nameInput = card.querySelector<HTMLInputElement>(".scw-mg-name");
      const textarea = card.querySelector<HTMLTextAreaElement>(".scw-mg-members");
      if (!nameInput || !textarea) return;
      const name = nameInput.value.trim();
      const members = parseMgMembers(textarea.value);
      if (name && members.length > 0) {
        newGroups.push({ name, members });
      }
    });

    chrome.storage.sync.set({ [MG_STORAGE_KEY]: newGroups }, () => {
      const total = newGroups.reduce((sum, g) => sum + g.members.length, 0);
      showStatus(`${newGroups.length}グループ（計${total}人）を保存しました`);
    });
  });

  return section;
}

async function createApiTokenSection(): Promise<HTMLElement> {
  const section = document.createElement("div");
  section.className = "plugin-card";

  const currentToken = await getApiToken();

  section.innerHTML = `
    <div class="plugin-info">
      <div class="plugin-name">Chatwork APIトークン</div>
      <div class="plugin-description">
        API連携が必要なプラグインで共通利用されます。<br>
        Chatwork右上メニュー → <strong>サービス連携</strong> → <strong>APIトークン</strong> で取得できます。
      </div>
      <div class="plugin-config" style="margin-top: 8px;">
        <input type="password" id="scw-api-token" class="api-key-input"
               placeholder="APIトークンを入力"
               value="${currentToken}">
      </div>
    </div>
  `;

  const input = section.querySelector<HTMLInputElement>("#scw-api-token")!;
  let debounce: ReturnType<typeof setTimeout>;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      await setApiToken(input.value);
      showStatus("APIトークンを保存しました");
    }, 500);
  });

  return section;
}

function appendCollapsible(card: HTMLElement, label: string, content: HTMLElement): void {
  const pluginInfo = card.querySelector(".plugin-info");
  if (!pluginInfo) return;

  const toggle = document.createElement("button");
  toggle.className = "plugin-config-toggle";
  toggle.innerHTML = `<span class="arrow">&#9654;</span> ${label}`;

  const section = document.createElement("div");
  section.className = "plugin-config-section";
  section.appendChild(content);

  toggle.addEventListener("click", () => {
    const isOpen = section.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
  });

  pluginInfo.appendChild(toggle);
  pluginInfo.appendChild(section);
}

async function render(): Promise<void> {
  const container = document.getElementById("plugin-list");
  if (!container) return;

  // 共通APIトークンセクションを最上部に表示
  const apiTokenSection = await createApiTokenSection();
  container.appendChild(apiTokenSection);

  const settings = await getPluginSettings();

  for (const config of PLUGIN_CONFIGS) {
    const card = createPluginCard(config, settings[config.id]);
    container.appendChild(card);

    if (config.id === "input-tools") {
      const btnConfig = await createInputToolsConfig();
      appendCollapsible(card, "ボタン設定", btnConfig);
    }

    if (config.id === "quick-task") {
      const taskConfig = await createQuickTaskConfig();
      appendCollapsible(card, "タスク設定", taskConfig);
    }

    if (config.id === "mention-group") {
      const mgConfig = await createMentionGroupConfig();
      appendCollapsible(card, "グループ管理", mgConfig);
    }
  }
}

render();
