import { PLUGIN_CONFIGS } from "../shared/plugin-configs";
import { createRoomMemberPicker, updatePickerSelection } from "./room-member-picker";
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

  const enabled = settings?.enabled ?? (config.defaultEnabled ?? true);

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

// ===== メンショングループ設定 =====
const MG_STORAGE_KEY = "quickMentionGroups";

interface MgMember {
  accountId: string;
  name: string;
}
interface MgGroup {
  name: string;
  members: MgMember[];
}

async function createMentionGroupConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const data = await chrome.storage.sync.get(MG_STORAGE_KEY);
  const groups: MgGroup[] = data[MG_STORAGE_KEY] || [];

  section.innerHTML = `
    <div class="plugin-description" style="margin-top: 8px;">
      グループ名を入力し、ルームからメンバーを選択して追加します。
    </div>
    <div id="scw-mg-group-list" style="margin-top: 12px;"></div>
    <div style="margin-top: 12px; display: flex; gap: 8px;">
      <button id="scw-mg-add" class="button-config-type" style="cursor: pointer; padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #f8f8f8;">+ グループ追加</button>
    </div>
  `;

  const listEl = section.querySelector("#scw-mg-group-list")!;

  function createGroupCard(group?: MgGroup): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = "border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fafbfc;";

    const members: MgMember[] = group?.members ? [...group.members] : [];

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <input type="text" class="scw-mg-name api-key-input" placeholder="グループ名（例: 開発チーム）" value="${escapeHtml(group?.name ?? "")}" style="flex: 1;">
        <button class="scw-mg-delete" style="border: none; background: none; color: #ccc; cursor: pointer; font-size: 18px; padding: 2px 6px;">&times;</button>
      </div>
      <div class="scw-mg-picker-area"></div>
      <div class="scw-mg-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;min-height:24px;"></div>
    `;

    const pickerArea = card.querySelector(".scw-mg-picker-area")!;
    const chipsEl = card.querySelector(".scw-mg-chips")!;
    const nameInput = card.querySelector<HTMLInputElement>(".scw-mg-name")!;

    function renderChips(): void {
      chipsEl.innerHTML = "";
      if (members.length === 0) {
        chipsEl.innerHTML = '<span style="font-size:12px;color:#888;">メンバーなし</span>';
        return;
      }
      for (const m of members) {
        const chip = document.createElement("span");
        chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #eee;font-size:12px;font-weight:600;";
        chip.innerHTML = `
          ${escapeHtml(m.name)}
          <button data-remove-mid="${m.accountId}" style="border:none;background:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;">&times;</button>
        `;
        chip.querySelector("button")!.addEventListener("click", async () => {
          const idx = members.findIndex((x) => x.accountId === m.accountId);
          if (idx >= 0) members.splice(idx, 1);
          renderChips();
          updatePickerSelection(pickerArea as HTMLElement, pickerPrefix, new Set(members.map((x) => Number(x.accountId))));
          await saveAllGroups();
        });
        chipsEl.appendChild(chip);
      }
    }

    const pickerPrefix = `scw-mg-picker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    createRoomMemberPicker({
      prefix: pickerPrefix,
      selectedIds: new Set(members.map((m) => Number(m.accountId))),
      onChange: async (accountId, name, checked) => {
        if (checked) {
          if (!members.some((m) => m.accountId === String(accountId))) {
            members.push({ accountId: String(accountId), name });
          }
        } else {
          const idx = members.findIndex((m) => m.accountId === String(accountId));
          if (idx >= 0) members.splice(idx, 1);
        }
        renderChips();
        await saveAllGroups();
      },
    }).then((picker) => {
      pickerArea.appendChild(picker);
    });

    // グループ名変更時も保存
    let nameDebounce: ReturnType<typeof setTimeout>;
    nameInput.addEventListener("input", () => {
      clearTimeout(nameDebounce);
      nameDebounce = setTimeout(() => saveAllGroups(), 500);
    });

    renderChips();

    card.querySelector(".scw-mg-delete")!.addEventListener("click", async () => {
      card.remove();
      await saveAllGroups();
    });

    // カードにメンバー配列を紐付け（保存時に参照）
    (card as unknown as { __members: MgMember[] }).__members = members;

    return card;
  }

  async function saveAllGroups(): Promise<void> {
    const cards = listEl.querySelectorAll<HTMLElement & { __members?: MgMember[] }>(":scope > div");
    const newGroups: MgGroup[] = [];
    cards.forEach((card) => {
      const nameInput = card.querySelector<HTMLInputElement>(".scw-mg-name");
      const members = card.__members;
      if (!nameInput || !members) return;
      const name = nameInput.value.trim();
      if (name && members.length > 0) {
        newGroups.push({ name, members: [...members] });
      }
    });

    await chrome.storage.sync.set({ [MG_STORAGE_KEY]: newGroups });
    const total = newGroups.reduce((sum, g) => sum + g.members.length, 0);
    showStatus(`${newGroups.length}グループ（計${total}人）を保存しました`);
  }

  // 既存グループを表示
  if (groups.length === 0) {
    listEl.appendChild(createGroupCard());
  } else {
    for (const g of groups) {
      listEl.appendChild(createGroupCard(g));
    }
  }

  section.querySelector("#scw-mg-add")!.addEventListener("click", () => {
    listEl.appendChild(createGroupCard());
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

// ===== VIP Notify 設定 =====

interface VipEntry {
  accountId: number;
  name: string;
  color: string;
}

async function createVipNotifyConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{ vips?: VipEntry[] }>("vip-notify");
  const vips: VipEntry[] = config?.vips ?? [];

  section.innerHTML = `
    <div class="plugin-description" style="margin-top: 8px;">
      ルームを選択してメンバーからVIPを登録します。バッジ色はVIPごとに設定できます。
    </div>
    <div class="scw-vip-picker-area"></div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">バッジ色</label>
      <div style="display: flex; gap: 6px; margin-top: 4px; align-items: center;">
        <button class="scw-vip-color-btn" data-color="#F44336" style="width:24px;height:24px;border-radius:50%;border:2px solid #333;background:#F44336;cursor:pointer;"></button>
        <button class="scw-vip-color-btn" data-color="#2196F3" style="width:24px;height:24px;border-radius:50%;border:2px solid transparent;background:#2196F3;cursor:pointer;"></button>
        <button class="scw-vip-color-btn" data-color="#FFC107" style="width:24px;height:24px;border-radius:50%;border:2px solid transparent;background:#FFC107;cursor:pointer;"></button>
        <button class="scw-vip-color-btn" data-color="#4CAF50" style="width:24px;height:24px;border-radius:50%;border:2px solid transparent;background:#4CAF50;cursor:pointer;"></button>
        <button class="scw-vip-color-btn" data-color="#9C27B0" style="width:24px;height:24px;border-radius:50%;border:2px solid transparent;background:#9C27B0;cursor:pointer;"></button>
        <input type="color" id="scw-vip-color-picker" value="#F44336" style="width:24px;height:24px;border:1px solid #ddd;border-radius:50%;padding:0;cursor:pointer;">
      </div>
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">登録済みVIP</label>
      <div id="scw-vip-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;min-height:24px;"></div>
    </div>
  `;

  let selectedColor = "#F44336";

  // カラープリセット
  section.querySelectorAll<HTMLButtonElement>(".scw-vip-color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedColor = btn.dataset.color!;
      section.querySelectorAll<HTMLButtonElement>(".scw-vip-color-btn").forEach((b) => {
        b.style.borderColor = b === btn ? "#333" : "transparent";
      });
      section.querySelector<HTMLInputElement>("#scw-vip-color-picker")!.value = selectedColor;
    });
  });

  section.querySelector<HTMLInputElement>("#scw-vip-color-picker")!.addEventListener("input", (e) => {
    selectedColor = (e.target as HTMLInputElement).value;
    section.querySelectorAll<HTMLButtonElement>(".scw-vip-color-btn").forEach((b) => {
      b.style.borderColor = "transparent";
    });
  });

  // 共通ピッカー
  const pickerArea = section.querySelector(".scw-vip-picker-area")!;
  const picker = await createRoomMemberPicker({
    prefix: "scw-vip",
    selectedIds: new Set(vips.map((v) => v.accountId)),
    onChange: async (accountId, name, checked) => {
      const cfg = await getPluginConfig<{ vips?: VipEntry[] }>("vip-notify");
      let updatedVips = cfg?.vips ?? [];

      if (checked) {
        if (!updatedVips.some((v) => v.accountId === accountId)) {
          updatedVips.push({ accountId, name, color: selectedColor });
        }
      } else {
        updatedVips = updatedVips.filter((v) => v.accountId !== accountId);
      }

      await setPluginConfig("vip-notify", { vips: updatedVips });
      showStatus("VIPを保存しました");
      renderVipChips(section, updatedVips);
    },
  });
  pickerArea.appendChild(picker);

  renderVipChips(section, vips);

  return section;
}

function renderVipChips(container: HTMLElement, vips: VipEntry[]): void {
  const chipsEl = container.querySelector<HTMLElement>("#scw-vip-chips")!;
  chipsEl.innerHTML = "";

  if (vips.length === 0) {
    chipsEl.innerHTML = '<span style="font-size:12px;color:#888;">まだ追加されていません</span>';
    return;
  }

  for (const vip of vips) {
    const chip = document.createElement("span");
    chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #eee;font-size:12px;font-weight:600;";
    chip.innerHTML = `
      <span style="width:10px;height:10px;border-radius:50%;background:${escapeHtml(vip.color)};flex-shrink:0;"></span>
      ${escapeHtml(vip.name)}
      <button data-remove-vip="${vip.accountId}" style="border:none;background:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;">&times;</button>
    `;

    chip.querySelector("button")!.addEventListener("click", async () => {
      const cfg = await getPluginConfig<{ vips?: VipEntry[] }>("vip-notify");
      const updated = (cfg?.vips ?? []).filter((v) => v.accountId !== vip.accountId);
      await setPluginConfig("vip-notify", { vips: updated });
      showStatus("VIPを削除しました");
      renderVipChips(container, updated);
      // ピッカーのチェックも更新
      updatePickerSelection(container, "scw-vip", new Set(updated.map((v) => v.accountId)));
    });

    chipsEl.appendChild(chip);
  }
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

    if (config.id === "vip-notify") {
      const vipConfig = await createVipNotifyConfig();
      appendCollapsible(card, "VIP管理", vipConfig);
    }
  }
}

render();
