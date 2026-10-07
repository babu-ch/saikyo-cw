import { PLUGIN_CONFIGS } from "../shared/plugin-configs";
import { html, setHtml } from "../shared/safe-html";
import { createRoomMemberPicker, updatePickerSelection } from "./room-member-picker";
import {
  ALL_BUTTON_METAS,
  getDefaultEnabledIds,
} from "../shared/input-tools-buttons";
import { ACTION_MENU_ITEMS, type ActionMenuItem } from "../shared/action-menu-items";
import { ALL_REACTIONS, EMOTICON_BASE, resolveReactions } from "../shared/reactions";
import {
  getPluginSettings,
  getPluginConfig,
  setPluginEnabled,
  setPluginConfig,
  getApiToken,
  setApiToken,
  isPluginEnabled,
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

  const enabled = isPluginEnabled(config, settings);
  const toggle = config.alwaysOn
    ? ""
    : html`<label class="toggle">
      <input type="checkbox" ${enabled ? "checked" : ""} data-plugin-id="${config.id}">
      <span class="toggle-slider"></span>
    </label>`;

  setHtml(card, html`
    <div class="plugin-info">
      <div class="plugin-name">
        ${config.name}
        ${config.requiresApiKey ? html`<span class="api-required-badge">APIキー必須</span>` : ""}
      </div>
      <div class="plugin-description">${config.description}</div>
    </div>
    ${toggle}
  `);

  const checkbox = card.querySelector<HTMLInputElement>(
    '.toggle input[type="checkbox"]',
  );
  checkbox?.addEventListener("change", async () => {
    await setPluginEnabled(config.id, checkbox.checked);
    showStatus(`${config.name} を${checkbox.checked ? "有効" : "無効"}にしました`);
  });

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

  setHtml(section, html`
    <div class="button-config" style="margin-top: 8px;"></div>
  `);

  const container = section.querySelector(".button-config")!;

  for (const meta of ALL_BUTTON_METAS) {
    const label = document.createElement("label");
    label.className = "button-config-item";

    const typeLabel =
      meta.type === "tag" ? "タグ" : meta.type === "emo" ? "絵文字" : "アクション";

    setHtml(label, html`
      <input type="checkbox" ${enabledIds.has(meta.id) ? "checked" : ""} data-button-id="${meta.id}">
      <span class="button-config-label">${meta.label}</span>
      <span class="button-config-desc">${meta.description}</span>
      <span class="button-config-type">${typeLabel}</span>
    `);

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

// ===== アクションメニュー設定 =====
async function createActionMenuConfig(
  settings: Record<string, PluginSettings>,
): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{
    hiddenItems?: string[];
    shownMoreItems?: string[];
  }>("action-menu");
  const hiddenItems = new Set(config?.hiddenItems ?? []);
  const shownMoreItems = new Set(config?.shownMoreItems ?? []);

  function isShown(item: ActionMenuItem): boolean | null {
    if (item.type === "native") return !hiddenItems.has(item.id);
    if (item.type === "more") return shownMoreItems.has(item.id);
    const pluginConfig = PLUGIN_CONFIGS.find((c) => c.id === item.id);
    return pluginConfig ? isPluginEnabled(pluginConfig, settings[item.id]) : null;
  }

  async function saveItems(): Promise<void> {
    const existing = (await getPluginConfig<Record<string, unknown>>("action-menu")) ?? {};
    await setPluginConfig("action-menu", {
      ...existing,
      hiddenItems: Array.from(hiddenItems),
      shownMoreItems: Array.from(shownMoreItems),
    });
  }

  const typeLabels: Record<ActionMenuItem["type"], string> = {
    native: "純正",
    plugin: "拡張",
    more: "その他から",
  };

  setHtml(section, html`
    <div class="action-menu-note">
      チェックを外した項目はメニューに出なくなります。「その他から」の項目はチェックすると「その他（…）」の手前に出て、「その他」の中からは消えます。中身が空になった「その他」は表示しません（他の人の発言はコピー・未読、自分の発言はそれに削除を加えた3つを出したとき）。
    </div>
    <div class="button-config"></div>
  `);

  const container = section.querySelector(".button-config")!;

  for (const item of ACTION_MENU_ITEMS) {
    const shown = isShown(item);
    if (shown === null) continue;

    const label = document.createElement("label");
    label.className = "button-config-item";
    setHtml(label, html`
      <input type="checkbox" ${shown ? "checked" : ""}>
      <span class="button-config-label">${item.label}</span>
      <span class="button-config-desc">${item.description}</span>
      <span class="button-config-type">${typeLabels[item.type]}</span>
    `);

    const cb = label.querySelector<HTMLInputElement>("input")!;
    cb.addEventListener("change", async () => {
      if (item.type === "native") {
        if (cb.checked) {
          hiddenItems.delete(item.id);
        } else {
          hiddenItems.add(item.id);
        }
        await saveItems();
      } else if (item.type === "more") {
        if (cb.checked) {
          shownMoreItems.add(item.id);
        } else {
          shownMoreItems.delete(item.id);
        }
        await saveItems();
      } else {
        // 拡張のボタンは、ボタンを追加するプラグイン自体をOn/Offする
        await setPluginEnabled(item.id, cb.checked);
      }
      showStatus(`「${item.label}」を${cb.checked ? "表示" : "非表示に"}しました`);
    });

    container.appendChild(label);

    const subSettings =
      item.id === "quick-task"
        ? createCollapsible("タスク設定", await createQuickTaskConfig())
        : item.id === "hover-reaction"
          ? createCollapsible("リアクション設定", await createHoverReactionConfig())
          : null;
    if (subSettings) {
      const sub = document.createElement("div");
      sub.className = "action-menu-sub";
      sub.appendChild(subSettings);
      container.appendChild(sub);
    }
  }

  return section;
}

async function createQuickTaskConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{ mode?: string; myChatId?: string; deadlineDays?: number }>(
    "quick-task",
  );
  const currentMode = config?.mode ?? "mychat-url";
  const currentChatId = config?.myChatId ?? "";
  const currentDeadline = config?.deadlineDays ?? 3;

  const modes = [
    { value: "mychat-url", label: "マイチャットにURLのみ" },
    { value: "mychat-message", label: "マイチャットにURL+メッセージ" },
    { value: "here-url", label: "現チャットにURLのみ (担当者=自分)" },
    { value: "here-message", label: "現チャットにURL+メッセージ (担当者=自分)" },
  ];

  setHtml(section, html`
    <div style="margin-top: 8px;">
      <label class="api-key-label">動作モード</label>
      <select id="scw-task-mode" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; margin-top: 4px;">
        ${modes.map((m) => html`<option value="${m.value}" ${m.value === currentMode ? "selected" : ""}>${m.label}</option>`)}
      </select>
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">マイチャットのルームID</label>
      <input type="text" id="scw-task-chatid" class="api-key-input"
             placeholder="例: 12345678"
             value="${currentChatId}">
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">期限デフォルト（今日からの日数）</label>
      <input type="number" id="scw-task-deadline" class="api-key-input"
             min="-1" step="1"
             placeholder="3"
             value="${String(currentDeadline)}">
      <div style="font-size: 11px; color: #888; margin-top: 4px;">0=今日、3=3日後、-1で期限なし</div>
    </div>
    <div style="font-size: 11px; color: #888; margin-top: 12px;">
      共通APIトークンを設定するとタスクAPI経由で登録します（画面遷移なし）。未設定時はマイチャットへ画面遷移して登録します。
    </div>
  `);

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

  const deadlineInput = section.querySelector<HTMLInputElement>("#scw-task-deadline")!;
  let deadlineDebounce: ReturnType<typeof setTimeout>;
  deadlineInput.addEventListener("input", () => {
    clearTimeout(deadlineDebounce);
    deadlineDebounce = setTimeout(async () => {
      const raw = deadlineInput.value.trim();
      const parsed = raw === "" ? 3 : Number(raw);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return;
      const existing = (await getPluginConfig<Record<string, unknown>>("quick-task")) ?? {};
      await setPluginConfig("quick-task", { ...existing, deadlineDays: parsed });
      showStatus("期限デフォルトを保存しました");
    }, 500);
  });

  return section;
}

// ===== クイック削除設定 =====
async function createQuickDeleteConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{ position?: "left" | "right"; shiftInstantDelete?: boolean }>("quick-delete");
  const currentPosition = config?.position === "right" ? "right" : "left";
  const shiftInstant = config?.shiftInstantDelete === true;

  const options = [
    { value: "left", label: "時刻の左側" },
    { value: "right", label: "時刻の右側" },
  ];

  setHtml(section, html`
    <div style="margin-top: 8px;">
      <label class="api-key-label">×ボタンの位置</label>
      <div style="display: flex; gap: 16px; margin-top: 6px;">
        ${options
          .map(
            (o) => html`
          <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; cursor: pointer;">
            <input type="radio" name="scw-qd-position" value="${o.value}" ${o.value === currentPosition ? "checked" : ""}>
            ${o.label}
          </label>`,
          )}
      </div>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">設定変更は新規メッセージから反映されます</div>
    </div>
    <div style="margin-top: 16px;">
      <label class="api-key-label">Shift+クリックで即削除</label>
      <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; margin-top: 6px;">
        <input type="checkbox" id="scw-qd-shift-instant" ${shiftInstant ? "checked" : ""}>
        ×ボタンをShift+クリックで確認ダイアログを出さず即削除する
      </label>
      <div style="font-size: 11px; color: #888; margin-top: 4px;">OFFの場合は常に確認ダイアログを表示します。設定変更は新規メッセージから反映されます</div>
    </div>
  `);

  section.querySelectorAll<HTMLInputElement>('input[name="scw-qd-position"]').forEach((radio) => {
    radio.addEventListener("change", async () => {
      if (!radio.checked) return;
      const existing = (await getPluginConfig<Record<string, unknown>>("quick-delete")) ?? {};
      await setPluginConfig("quick-delete", { ...existing, position: radio.value });
      showStatus("×ボタンの位置を保存しました");
    });
  });

  const shiftCheckbox = section.querySelector<HTMLInputElement>("#scw-qd-shift-instant");
  shiftCheckbox?.addEventListener("change", async () => {
    const existing = (await getPluginConfig<Record<string, unknown>>("quick-delete")) ?? {};
    await setPluginConfig("quick-delete", { ...existing, shiftInstantDelete: shiftCheckbox.checked });
    showStatus(shiftCheckbox.checked ? "Shift+クリック即削除を有効にしました" : "Shift+クリック即削除を無効にしました");
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
  const groups = (data[MG_STORAGE_KEY] as MgGroup[] | undefined) ?? [];

  setHtml(section, html`
    <div class="plugin-description" style="margin-top: 8px;">
      グループ名を入力し、ルームからメンバーを選択して追加します。
    </div>
    <div id="scw-mg-group-list" style="margin-top: 12px;"></div>
    <div style="margin-top: 12px; display: flex; gap: 8px;">
      <button id="scw-mg-add" class="button-config-type" style="cursor: pointer; padding: 6px 12px; border: 1px solid #ddd; border-radius: 6px; background: #f8f8f8;">+ グループ追加</button>
    </div>
  `);

  const listEl = section.querySelector("#scw-mg-group-list")!;

  function createGroupCard(group?: MgGroup): HTMLElement {
    const card = document.createElement("div");
    card.style.cssText = "border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fafbfc;";

    const members: MgMember[] = group?.members ? [...group.members] : [];

    setHtml(card, html`
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <input type="text" class="scw-mg-name api-key-input" placeholder="グループ名（例: 開発チーム）" value="${group?.name ?? ""}" style="flex: 1;">
        <button class="scw-mg-delete" style="border: none; background: none; color: #ccc; cursor: pointer; font-size: 18px; padding: 2px 6px;">&times;</button>
      </div>
      <div class="scw-mg-picker-area"></div>
      <div class="scw-mg-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;min-height:24px;"></div>
    `);

    const pickerArea = card.querySelector(".scw-mg-picker-area")!;
    const chipsEl = card.querySelector(".scw-mg-chips")!;
    const nameInput = card.querySelector<HTMLInputElement>(".scw-mg-name")!;

    function renderChips(): void {
      chipsEl.replaceChildren();
      if (members.length === 0) {
        setHtml(chipsEl, html`<span style="font-size:12px;color:#888;">メンバーなし</span>`);
        return;
      }
      for (const m of members) {
        const chip = document.createElement("span");
        chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #eee;font-size:12px;font-weight:600;";
        setHtml(chip, html`
          ${m.name}
          <button data-remove-mid="${m.accountId}" style="border:none;background:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;">&times;</button>
        `);
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

  setHtml(section, html`
    <div class="plugin-info">
      <div class="plugin-name">Chatwork APIトークン</div>
      <div class="plugin-description">
        API連携が必要なプラグインで共通利用されます（必須ではありません）。<br>
        Chatwork右上メニュー → <strong>サービス連携</strong> → <strong>APIトークン</strong> で取得できます。
      </div>
      <div class="plugin-config" style="margin-top: 8px;">
        <input type="password" id="scw-api-token" class="api-key-input"
               placeholder="APIトークンを入力"
               value="${currentToken}">
      </div>
    </div>
  `);

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

  setHtml(section, html`
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
  `);

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
  chipsEl.replaceChildren();

  if (vips.length === 0) {
    setHtml(chipsEl, html`<span style="font-size:12px;color:#888;">まだ追加されていません</span>`);
    return;
  }

  for (const vip of vips) {
    const chip = document.createElement("span");
    chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #eee;font-size:12px;font-weight:600;";
    setHtml(chip, html`
      <span style="width:10px;height:10px;border-radius:50%;background:${vip.color};flex-shrink:0;"></span>
      ${vip.name}
      <button data-remove-vip="${vip.accountId}" style="border:none;background:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;">&times;</button>
    `);

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

// ===== 自動既読設定 =====

interface AutoReadRoomConfig {
  enabled: boolean;
  keywords: string[];
}

async function createAutoReadConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{ autoReadRooms?: Record<string, AutoReadRoomConfig> }>("vip-notify");
  const autoReadRooms: Record<string, AutoReadRoomConfig> = config?.autoReadRooms ?? {};

  setHtml(section, html`
    <div style="margin-top: 8px; padding: 10px 12px; background: #fff3e0; border: 1px solid #ffe0b2; border-radius: 8px; font-size: 12px; color: #e65100; line-height: 1.6;">
      <strong>注意:</strong> 有効にしたルームの未読メッセージは条件に基づいて<strong>自動的に既読</strong>になります。VIPの発言・自分宛てメッセージ・キーワードを含む発言は既読にしません。意図しない既読が発生する可能性があるため、設定は慎重に行ってください。
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">設定済みルーム</label>
      <div id="scw-ar-room-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;min-height:24px;"></div>
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">ルームを追加</label>
      <select id="scw-ar-room-select" class="api-key-input" style="margin-top: 4px;">
        <option value="">-- ルーム読み込み中... --</option>
      </select>
    </div>
    <div id="scw-ar-room-config" hidden style="margin-top: 12px; padding: 12px; border: 1px solid #eee; border-radius: 8px; background: #fafbfc;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <label class="api-key-label" id="scw-ar-room-name"></label>
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
          <input id="scw-ar-enabled" type="checkbox">
          <span>自動既読を有効にする</span>
        </label>
      </div>
      <div style="margin-top: 8px;">
        <label class="api-key-label">残すキーワード</label>
        <div style="display:flex;gap:6px;margin-top:4px;">
          <input id="scw-ar-keyword-input" type="text" class="api-key-input" placeholder="キーワードを入力してEnter" style="flex:1;">
          <button id="scw-ar-keyword-add" style="padding:8px 12px;border:1px solid #ddd;border-radius:6px;background:#f8f8f8;cursor:pointer;font-size:13px;">追加</button>
        </div>
        <div id="scw-ar-keyword-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;min-height:24px;"></div>
        <p style="font-size:11px;color:#888;margin-top:4px;line-height:1.5;">
          これらのキーワードを含む発言は未読のまま残します。VIPの発言・自分宛てメッセージも残します。
        </p>
      </div>
    </div>
  `);

  // ルーム一覧取得
  const token = await getApiToken();
  const roomSelect = section.querySelector<HTMLSelectElement>("#scw-ar-room-select")!;
  let allRooms: Array<{ room_id: number; name: string; type: string }> = [];

  if (token) {
    const res = await chrome.runtime.sendMessage({ type: "fetchRooms", token });
    if (res?.ok && Array.isArray(res.rooms)) {
      allRooms = res.rooms.filter((r: { type: string }) => r.type === "group");
      setHtml(roomSelect, html`<option value="">-- ルームを選択 --</option>`);
      for (const room of allRooms) {
        const opt = document.createElement("option");
        opt.value = String(room.room_id);
        opt.textContent = room.name;
        roomSelect.appendChild(opt);
      }
    } else {
      setHtml(roomSelect, html`<option value="">-- 取得失敗 --</option>`);
    }
  } else {
    setHtml(roomSelect, html`<option value="">-- APIトークンを先に設定してください --</option>`);
  }

  const configPanel = section.querySelector<HTMLElement>("#scw-ar-room-config")!;
  const roomNameLabel = section.querySelector<HTMLElement>("#scw-ar-room-name")!;
  const enabledCheckbox = section.querySelector<HTMLInputElement>("#scw-ar-enabled")!;
  const keywordInput = section.querySelector<HTMLInputElement>("#scw-ar-keyword-input")!;
  const keywordAddBtn = section.querySelector<HTMLButtonElement>("#scw-ar-keyword-add")!;
  const keywordChips = section.querySelector<HTMLElement>("#scw-ar-keyword-chips")!;

  let selectedRoomId = "";

  async function saveAutoReadRooms(rooms: Record<string, AutoReadRoomConfig>): Promise<void> {
    const existing = await getPluginConfig<Record<string, unknown>>("vip-notify") ?? {};
    await setPluginConfig("vip-notify", { ...existing, autoReadRooms: rooms });
  }

  function renderRoomChips(): void {
    const chipsEl = section.querySelector<HTMLElement>("#scw-ar-room-chips")!;
    chipsEl.replaceChildren();

    const entries = Object.entries(autoReadRooms).filter(([, cfg]) => cfg.enabled);
    if (entries.length === 0) {
      setHtml(chipsEl, html`<span style="font-size:12px;color:#888;">まだ設定されていません</span>`);
      return;
    }

    for (const [roomId, cfg] of entries) {
      const room = allRooms.find((r) => String(r.room_id) === roomId);
      const name = room?.name ?? `ルーム ${roomId}`;
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#e3f2fd;border:1px solid #bbdefb;font-size:12px;font-weight:600;cursor:pointer;";
      setHtml(chip, html`
        ${name} <small style="color:#888;">(${cfg.keywords.length}語)</small>
        <button data-remove-ar="${roomId}" style="border:none;background:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;">&times;</button>
      `);

      chip.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName === "BUTTON") return;
        roomSelect.value = roomId;
        roomSelect.dispatchEvent(new Event("change"));
      });

      chip.querySelector("button")!.addEventListener("click", async () => {
        delete autoReadRooms[roomId];
        await saveAutoReadRooms(autoReadRooms);
        showStatus("自動既読設定を削除しました");
        renderRoomChips();
        if (selectedRoomId === roomId) {
          configPanel.hidden = true;
          selectedRoomId = "";
        }
      });

      chipsEl.appendChild(chip);
    }
  }

  function renderKeywordChips(): void {
    keywordChips.replaceChildren();
    const cfg = autoReadRooms[selectedRoomId];
    const keywords = cfg?.keywords ?? [];

    if (keywords.length === 0) {
      setHtml(keywordChips, html`<span style="font-size:12px;color:#888;">キーワードなし（全て既読対象）</span>`);
      return;
    }

    for (const kw of keywords) {
      const chip = document.createElement("span");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:#fff;border:1px solid #eee;font-size:12px;font-weight:600;";
      setHtml(chip, html`
        ${kw}
        <button style="border:none;background:none;cursor:pointer;color:#ccc;font-size:14px;padding:0 2px;">&times;</button>
      `);
      chip.querySelector("button")!.addEventListener("click", async () => {
        const c = autoReadRooms[selectedRoomId];
        if (c) {
          c.keywords = c.keywords.filter((k) => k !== kw);
          await saveAutoReadRooms(autoReadRooms);
          showStatus("キーワードを削除しました");
          renderKeywordChips();
        }
      });
      keywordChips.appendChild(chip);
    }
  }

  // ルーム選択
  roomSelect.addEventListener("change", () => {
    selectedRoomId = roomSelect.value;
    if (!selectedRoomId) {
      configPanel.hidden = true;
      return;
    }

    const room = allRooms.find((r) => String(r.room_id) === selectedRoomId);
    roomNameLabel.textContent = room?.name ?? selectedRoomId;

    if (!autoReadRooms[selectedRoomId]) {
      autoReadRooms[selectedRoomId] = { enabled: false, keywords: [] };
    }

    enabledCheckbox.checked = autoReadRooms[selectedRoomId].enabled;
    configPanel.hidden = false;
    renderKeywordChips();
  });

  // 有効/無効トグル
  enabledCheckbox.addEventListener("change", async () => {
    if (!selectedRoomId) return;
    autoReadRooms[selectedRoomId].enabled = enabledCheckbox.checked;
    await saveAutoReadRooms(autoReadRooms);
    showStatus(enabledCheckbox.checked ? "自動既読を有効にしました" : "自動既読を無効にしました");
    renderRoomChips();
  });

  // キーワード追加
  async function addKeyword(): Promise<void> {
    const value = keywordInput.value.trim();
    if (!value || !selectedRoomId) return;
    const cfg = autoReadRooms[selectedRoomId];
    if (!cfg.keywords.includes(value)) {
      cfg.keywords.push(value);
      await saveAutoReadRooms(autoReadRooms);
      showStatus("キーワードを追加しました");
    }
    keywordInput.value = "";
    renderKeywordChips();
  }

  keywordAddBtn.addEventListener("click", addKeyword);

  // IME対応
  let isComposing = false;
  keywordInput.addEventListener("compositionstart", () => { isComposing = true; });
  keywordInput.addEventListener("compositionend", () => { isComposing = false; });
  keywordInput.addEventListener("keydown", (e) => {
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  });

  renderRoomChips();

  return section;
}

async function createReplyThreadConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{
    alignment?: "left" | "right";
    compact?: boolean;
  }>("reply-thread");
  const isLeft = (config?.alignment ?? "right") === "left";
  const compact = config?.compact ?? false;

  setHtml(section, html`
    <div style="margin-top: 8px; display: flex; gap: 16px; align-items: center;">
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
        <input type="radio" name="scw-rt-align" value="left" ${isLeft ? "checked" : ""}>
        <span>👈 左寄せ</span>
      </label>
      <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
        <input type="radio" name="scw-rt-align" value="right" ${!isLeft ? "checked" : ""}>
        <span>右寄せ 👉</span>
      </label>
    </div>
    <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <span>コンパクト表示<span style="color: #888; font-size: 11px; margin-left: 6px;">（「💬 N」だけ表示）</span></span>
      <label class="toggle">
        <input type="checkbox" id="scw-rt-compact" ${compact ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `);

  section
    .querySelectorAll<HTMLInputElement>('input[name="scw-rt-align"]')
    .forEach((input) => {
      input.addEventListener("change", async () => {
        if (!input.checked) return;
        const alignment = input.value as "right" | "left";
        const existing =
          (await getPluginConfig<Record<string, unknown>>("reply-thread")) ?? {};
        await setPluginConfig("reply-thread", { ...existing, alignment });
        showStatus(`表示位置を${alignment === "left" ? "左寄せ" : "右寄せ"}にしました`);
      });
    });

  section
    .querySelector<HTMLInputElement>("#scw-rt-compact")!
    .addEventListener("change", async (e) => {
      const compact = (e.target as HTMLInputElement).checked;
      const existing =
        (await getPluginConfig<Record<string, unknown>>("reply-thread")) ?? {};
      await setPluginConfig("reply-thread", { ...existing, compact });
      showStatus(compact ? "コンパクト表示にしました" : "通常表示にしました");
    });

  return section;
}

async function createHoverReactionConfig(): Promise<HTMLElement> {
  const section = document.createElement("div");

  const config = await getPluginConfig<{
    display?: "below" | "inline";
    alignment?: "right" | "left";
    reactions?: string[];
    stopAnimation?: boolean;
  }>("hover-reaction");
  let selected = resolveReactions(config?.reactions).map((r) => r.emoticon);
  let display = config?.display === "inline" ? "inline" : "below";
  let alignment = config?.alignment === "left" ? "left" : "right";
  const stopAnimation = config?.stopAnimation ?? false;

  setHtml(section, html`
    <div class="reaction-config-label">表示位置</div>
    <div class="reaction-config-options">
      <label><input type="radio" name="scw-hr-display" value="below" ${display === "below" ? "checked" : ""}> メニューの下の段</label>
      <label><input type="radio" name="scw-hr-display" value="inline" ${display === "inline" ? "checked" : ""}> 「リアクション」の位置</label>
    </div>
    <div class="reaction-config-options reaction-config-align">
      <label><input type="radio" name="scw-hr-align" value="left" ${alignment === "left" ? "checked" : ""}> 👈 左寄せ</label>
      <label><input type="radio" name="scw-hr-align" value="right" ${alignment === "right" ? "checked" : ""}> 右寄せ 👉</label>
    </div>
    <div class="reaction-config-note"></div>
    <div class="reaction-config-label">メニューでの見え方（ドラッグで並べ替え・×で外す）</div>
    <div class="reaction-preview-menu">返信　リアクション　引用 …</div>
    <div class="reaction-preview"></div>
    <div class="reaction-config-label">追加する（押すと末尾に追加・ドラッグで好きな位置へ）</div>
    <div class="reaction-grid"></div>
    <div style="margin-top: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
      <span>絵文字のアニメーションを停止<span style="color: #888; font-size: 11px; margin-left: 6px;">（静止画で表示）</span></span>
      <label class="toggle">
        <input type="checkbox" id="scw-hr-stop-anim" ${stopAnimation ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `);

  const previewEl = section.querySelector<HTMLElement>(".reaction-preview")!;
  const previewMenuEl = section.querySelector<HTMLElement>(".reaction-preview-menu")!;
  const alignEl = section.querySelector<HTMLElement>(".reaction-config-align")!;
  const noteEl = section.querySelector<HTMLElement>(".reaction-config-note")!;
  const gridEl = section.querySelector<HTMLElement>(".reaction-grid")!;
  const byEmoticon = new Map(ALL_REACTIONS.map((r) => [r.emoticon, r]));

  // ドラッグ中のリアクション。fromGrid=trueなら下の一覧から持ってきたもの
  let drag: { emoticon: string; fromGrid: boolean; element: HTMLElement; handled: boolean } | null = null;

  function createEmoticonImg(emoticon: string): HTMLImageElement {
    const img = document.createElement("img");
    img.src = `${EMOTICON_BASE}${emoticon}`;
    img.alt = byEmoticon.get(emoticon)?.describe ?? "";
    img.draggable = false;
    return img;
  }

  function createStatic(text: string): HTMLElement {
    const el = document.createElement("span");
    el.className = "reaction-preview__static";
    el.textContent = text;
    return el;
  }

  async function save(next: string[], message: string): Promise<void> {
    selected = next;
    render();
    const existing =
      (await getPluginConfig<Record<string, unknown>>("hover-reaction")) ?? {};
    await setPluginConfig("hover-reaction", { ...existing, reactions: selected });
    showStatus(message);
  }

  function nameOf(emoticon: string): string {
    return byEmoticon.get(emoticon)?.describe ?? "";
  }

  function createPreviewItem(emoticon: string): HTMLElement {
    const item = document.createElement("span");
    item.className = "reaction-preview__item";
    item.draggable = true;
    item.dataset.emoticon = emoticon;
    item.title = nameOf(emoticon);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reaction-preview__remove";
    remove.textContent = "×";
    remove.title = "外す";
    remove.addEventListener("click", () => {
      void save(
        selected.filter((e) => e !== emoticon),
        `「${nameOf(emoticon)}」を外しました`,
      );
    });

    item.append(createEmoticonImg(emoticon), remove);
    item.addEventListener("dragstart", (e) => {
      drag = { emoticon, fromGrid: false, element: item, handled: false };
      item.classList.add("is-dragging");
      e.dataTransfer?.setData("text/plain", emoticon);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragend", () => finishDrag());
    return item;
  }

  function previewItems(): HTMLElement[] {
    return Array.from(previewEl.querySelectorAll<HTMLElement>(".reaction-preview__item"));
  }

  function orderInPreview(): string[] {
    return previewItems().map((el) => el.dataset.emoticon ?? "");
  }

  // ポインタの位置から、ドラッグ中のリアクションをどの手前に入れるかを決める（折り返しにも対応）
  function findInsertBefore(x: number, y: number, dragging: HTMLElement): Element | null {
    for (const el of previewItems()) {
      if (el === dragging) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return el;
    }
    // 末尾（「リアクションの位置」のときは純正の「リアクション」の手前）
    return previewEl.querySelector(".reaction-preview__more");
  }

  function finishDrag(): void {
    const current = drag;
    drag = null;
    if (!current) return;
    current.element.classList.remove("is-dragging");
    gridEl.classList.remove("is-drop-target");
    if (current.handled) return;
    if (current.fromGrid) {
      // 見本の外で離したら追加しない
      render();
      return;
    }
    // 並べ替えはドラッグ中に見本の上で動かしてあるので、その並びで確定する
    const order = orderInPreview();
    if (order.join() !== selected.join()) {
      void save(order, "並び順を保存しました");
    }
  }

  previewEl.addEventListener("dragover", (e) => {
    if (!drag) return;
    e.preventDefault();
    if (drag.fromGrid && !previewEl.contains(drag.element)) {
      drag.element.classList.add("is-dragging");
    }
    const before = findInsertBefore(e.clientX, e.clientY, drag.element);
    // 一覧から持ってきてまだ見本に入っていないものは、位置が末尾でも必ず入れる
    if (!previewEl.contains(drag.element) || before !== drag.element.nextSibling) {
      previewEl.insertBefore(drag.element, before);
    }
  });

  previewEl.addEventListener("dragleave", (e) => {
    // 一覧から持ってきたものは、見本の外に出たら仮置きを消す
    if (!drag?.fromGrid || previewEl.contains(e.relatedTarget as Node | null)) return;
    drag.element.remove();
  });

  previewEl.addEventListener("drop", (e) => {
    if (!drag) return;
    e.preventDefault();
    drag.handled = true;
    const { emoticon, fromGrid } = drag;
    void save(
      orderInPreview(),
      fromGrid ? `「${nameOf(emoticon)}」を追加しました` : "並び順を保存しました",
    );
  });

  // 見本から下の一覧へドラッグしたら外す
  gridEl.addEventListener("dragover", (e) => {
    if (!drag || drag.fromGrid) return;
    e.preventDefault();
    gridEl.classList.add("is-drop-target");
  });
  gridEl.addEventListener("dragleave", (e) => {
    if (!gridEl.contains(e.relatedTarget as Node | null)) {
      gridEl.classList.remove("is-drop-target");
    }
  });
  gridEl.addEventListener("drop", (e) => {
    if (!drag || drag.fromGrid) return;
    e.preventDefault();
    drag.handled = true;
    const { emoticon } = drag;
    void save(
      selected.filter((x) => x !== emoticon),
      `「${nameOf(emoticon)}」を外しました`,
    );
  });

  function renderPreview(): void {
    const items = selected.map(createPreviewItem);
    const empty = createStatic("（なし）");
    empty.classList.add("reaction-preview__empty");
    const inline = display === "inline";

    // メニューの下の段のときは、メニューの下に段だけを並べる
    previewMenuEl.hidden = inline;
    alignEl.hidden = inline;
    previewEl.classList.toggle("is-below", !inline);
    previewEl.classList.toggle("is-left", !inline && alignment === "left");
    noteEl.textContent = inline
      ? "純正の「リアクション」はアイコンだけになり、押すと全種類の一覧を開きます。自分が押しているリアクションは色付きで表示し、もう一度押すと取り消します。"
      : "";

    if (!inline) {
      previewEl.replaceChildren(...(items.length > 0 ? items : [empty]));
      return;
    }
    const more = createStatic("☺︎");
    more.classList.add("reaction-preview__more");
    more.title = "純正の「リアクション」（押すと全種類の一覧）";
    previewEl.replaceChildren(
      createStatic("返信"),
      ...(items.length > 0 ? items : [empty]),
      more,
      createStatic("引用 …"),
    );
  }

  function renderGrid(): void {
    gridEl.replaceChildren(
      ...ALL_REACTIONS.map((r) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reaction-grid__btn";
        btn.title = r.describe;
        const added = selected.includes(r.emoticon);
        btn.disabled = added;
        btn.draggable = !added;
        btn.appendChild(createEmoticonImg(r.emoticon));
        btn.addEventListener("click", () => {
          void save([...selected, r.emoticon], `「${r.describe}」を追加しました`);
        });
        btn.addEventListener("dragstart", (e) => {
          const placeholder = createPreviewItem(r.emoticon);
          drag = { emoticon: r.emoticon, fromGrid: true, element: placeholder, handled: false };
          e.dataTransfer?.setData("text/plain", r.emoticon);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
          previewEl.querySelector(".reaction-preview__empty")?.remove();
        });
        btn.addEventListener("dragend", () => finishDrag());
        return btn;
      }),
    );
  }

  function render(): void {
    renderPreview();
    renderGrid();
  }

  render();

  async function saveOption(values: Record<string, unknown>, message: string): Promise<void> {
    const existing =
      (await getPluginConfig<Record<string, unknown>>("hover-reaction")) ?? {};
    await setPluginConfig("hover-reaction", { ...existing, ...values });
    showStatus(message);
  }

  section.querySelectorAll<HTMLInputElement>('input[name="scw-hr-display"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      display = input.value === "inline" ? "inline" : "below";
      renderPreview();
      void saveOption(
        { display },
        display === "inline" ? "「リアクション」の位置に並べます" : "メニューの下の段に並べます",
      );
    });
  });

  section.querySelectorAll<HTMLInputElement>('input[name="scw-hr-align"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      alignment = input.value === "left" ? "left" : "right";
      renderPreview();
      void saveOption(
        { alignment },
        `表示位置を${alignment === "left" ? "左寄せ" : "右寄せ"}にしました`,
      );
    });
  });

  section
    .querySelector<HTMLInputElement>("#scw-hr-stop-anim")!
    .addEventListener("change", async (e) => {
      const stop = (e.target as HTMLInputElement).checked;
      const existing =
        (await getPluginConfig<Record<string, unknown>>("hover-reaction")) ?? {};
      await setPluginConfig("hover-reaction", { ...existing, stopAnimation: stop });
      showStatus(
        stop ? "アニメーションを停止します" : "アニメーションを有効にします",
      );
    });

  return section;
}

function createCollapsible(label: string, content: HTMLElement): DocumentFragment {
  const toggle = document.createElement("button");
  toggle.className = "plugin-config-toggle";
  setHtml(toggle, html`<span class="arrow">&#9654;</span> ${label}`);

  const section = document.createElement("div");
  section.className = "plugin-config-section";
  section.appendChild(content);

  toggle.addEventListener("click", () => {
    const isOpen = section.classList.toggle("open");
    toggle.classList.toggle("open", isOpen);
  });

  const fragment = document.createDocumentFragment();
  fragment.append(toggle, section);
  return fragment;
}

function appendCollapsible(card: HTMLElement, label: string, content: HTMLElement): void {
  card.querySelector(".plugin-info")?.appendChild(createCollapsible(label, content));
}

async function renderPluginCard(
  container: HTMLElement,
  config: (typeof PLUGIN_CONFIGS)[number],
  settings: Record<string, PluginSettings>,
): Promise<void> {
  const card = createPluginCard(config, settings[config.id]);
  container.appendChild(card);

  if (config.id === "input-tools") {
    appendCollapsible(card, "ボタン設定", await createInputToolsConfig());
  }
  if (config.id === "action-menu") {
    appendCollapsible(card, "表示する項目", await createActionMenuConfig(settings));
  }
  if (config.id === "mention-group") {
    appendCollapsible(card, "グループ管理", await createMentionGroupConfig());
  }
  if (config.id === "vip-notify") {
    appendCollapsible(card, "VIP管理", await createVipNotifyConfig());
    appendCollapsible(card, "自動既読", await createAutoReadConfig());
  }
  if (config.id === "reply-thread") {
    appendCollapsible(card, "表示設定", await createReplyThreadConfig());
  }
  if (config.id === "quick-delete") {
    appendCollapsible(card, "表示設定", await createQuickDeleteConfig());
  }
}

async function render(): Promise<void> {
  const container = document.getElementById("plugin-list");
  if (!container) return;

  const settings = await getPluginSettings();
  // managedBy のプラグインは管理元のカードの中でOn/Offする
  const cardConfigs = PLUGIN_CONFIGS.filter((c) => !c.managedBy);

  // APIキー不要なプラグインを先に描画
  for (const config of cardConfigs.filter((c) => !c.requiresApiKey)) {
    await renderPluginCard(container, config, settings);
  }

  // APIトークン入力欄
  container.appendChild(await createApiTokenSection());

  // APIキー必須プラグインを最後に描画
  for (const config of cardConfigs.filter((c) => c.requiresApiKey)) {
    await renderPluginCard(container, config, settings);
  }
}

render();
