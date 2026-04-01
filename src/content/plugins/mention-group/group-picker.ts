import { EXTENSION_PREFIX } from "../../../shared/constants";
import { getPluginConfig, setPluginConfig } from "../../../shared/storage";
import { insertAtCursor } from "../../../shared/react-input";
import { CW } from "../../../shared/chatwork-selectors";

const PLUGIN_ID = "mention-group";

export interface MemberInfo {
  accountId: string;
  name: string;
}

export interface MentionGroup {
  name: string;
  members: MemberInfo[];
}

interface MentionGroupConfig {
  groups: MentionGroup[];
}

async function getGroups(): Promise<MentionGroup[]> {
  const config = await getPluginConfig<MentionGroupConfig>(PLUGIN_ID);
  return config?.groups ?? [];
}

async function saveGroups(groups: MentionGroup[]): Promise<void> {
  await setPluginConfig(PLUGIN_ID, { groups });
}

function buildMentionText(members: MemberInfo[]): string {
  return members.map((m) => `[To:${m.accountId}]${m.name}さん`).join(" ");
}

function insertMention(members: MemberInfo[]): void {
  const chatInput = document.querySelector(CW.CHAT_INPUT) as
    | HTMLTextAreaElement
    | null;
  if (!chatInput) return;

  const mentionText = buildMentionText(members);
  chatInput.focus();
  insertAtCursor(chatInput, mentionText + "\n");
}

function createDropdown(groups: MentionGroup[]): HTMLElement {
  const dropdown = document.createElement("div");
  dropdown.setAttribute(`data-${EXTENSION_PREFIX}-mention-dropdown`, "true");
  dropdown.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    min-width: 200px;
    z-index: 10001;
    overflow: hidden;
    margin-bottom: 4px;
  `;

  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "グループ未登録";
    empty.style.cssText = "padding: 12px 16px; color: #999; font-size: 13px;";
    dropdown.appendChild(empty);
  } else {
    for (const group of groups) {
      const item = document.createElement("div");
      item.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.15s;
        border-bottom: 1px solid #f0f0f0;
      `;
      item.textContent = `${group.name} (${group.members.length}人)`;
      item.addEventListener("mouseenter", () => {
        item.style.background = "#f0f7ff";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "white";
      });
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        insertMention(group.members);
        dropdown.remove();
      });
      dropdown.appendChild(item);
    }
  }

  // グループ管理リンク
  const manageItem = document.createElement("div");
  manageItem.style.cssText = `
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
    color: #4a9eff;
    text-align: center;
    background: #fafafa;
  `;
  manageItem.textContent = "グループを管理...";
  manageItem.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.remove();
    showGroupManager();
  });
  dropdown.appendChild(manageItem);

  // 外部クリックで閉じる
  const closeHandler = (e: MouseEvent) => {
    if (!dropdown.contains(e.target as Node)) {
      dropdown.remove();
      document.removeEventListener("click", closeHandler);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler), 0);

  return dropdown;
}

function getCurrentRoomMembers(): MemberInfo[] {
  const members: MemberInfo[] = [];
  const memberElements = document.querySelectorAll(
    '#_memberList li[data-account-id], [data-testid="room-member-list"] li[data-account-id]',
  );
  memberElements.forEach((el) => {
    const accountId = el.getAttribute("data-account-id");
    const name =
      el.querySelector(".roomMemberListItem__name")?.textContent?.trim() ??
      el.getAttribute("data-account-name") ??
      "";
    if (accountId) {
      members.push({ accountId, name });
    }
  });
  return members;
}

async function showGroupManager(): Promise<void> {
  const existing = document.querySelector(
    `[data-${EXTENSION_PREFIX}-group-manager]`,
  );
  if (existing) {
    existing.remove();
    return;
  }

  const groups = await getGroups();
  const roomMembers = getCurrentRoomMembers();

  const overlay = document.createElement("div");
  overlay.setAttribute(`data-${EXTENSION_PREFIX}-group-manager`, "true");
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 480px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  `;

  let editingGroups = JSON.parse(JSON.stringify(groups)) as MentionGroup[];

  function renderModal(): void {
    modal.innerHTML = `
      <h2 style="margin: 0 0 16px; font-size: 18px;">メンショングループ管理</h2>
      <div id="scw-group-list"></div>
      <div style="margin-top: 16px; display: flex; gap: 8px;">
        <button id="scw-add-group" style="
          padding: 8px 16px; border: 1px solid #4a9eff; border-radius: 6px;
          background: white; color: #4a9eff; cursor: pointer; font-size: 13px;
        ">+ グループ追加</button>
        <div style="flex: 1;"></div>
        <button id="scw-save-groups" style="
          padding: 8px 16px; border: none; border-radius: 6px;
          background: #4a9eff; color: white; cursor: pointer; font-size: 13px;
        ">保存</button>
        <button id="scw-cancel-groups" style="
          padding: 8px 16px; border: 1px solid #ccc; border-radius: 6px;
          background: white; color: #666; cursor: pointer; font-size: 13px;
        ">キャンセル</button>
      </div>
    `;

    const list = modal.querySelector("#scw-group-list")!;

    for (let i = 0; i < editingGroups.length; i++) {
      const group = editingGroups[i];
      const groupEl = document.createElement("div");
      groupEl.style.cssText = `
        border: 1px solid #e0e0e0; border-radius: 8px;
        padding: 12px; margin-bottom: 12px;
      `;
      groupEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <input type="text" value="${group.name}" placeholder="グループ名"
                 data-group-index="${i}"
                 style="flex: 1; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          <button data-delete-group="${i}" style="
            padding: 4px 8px; border: 1px solid #e66; border-radius: 4px;
            background: white; color: #e66; cursor: pointer; font-size: 12px;
          ">削除</button>
        </div>
        <div style="font-size: 12px; color: #888; margin-bottom: 4px;">
          メンバー: ${group.members.map((m) => m.name).join(", ") || "未設定"}
        </div>
        <div style="font-size: 12px; color: #4a9eff; cursor: pointer;"
             data-edit-members="${i}">メンバーを編集...</div>
      `;

      // グループ名変更
      const nameInput = groupEl.querySelector<HTMLInputElement>("input")!;
      nameInput.addEventListener("input", () => {
        editingGroups[i].name = nameInput.value;
      });

      // グループ削除
      groupEl
        .querySelector(`[data-delete-group="${i}"]`)!
        .addEventListener("click", () => {
          editingGroups.splice(i, 1);
          renderModal();
        });

      // メンバー編集
      groupEl
        .querySelector(`[data-edit-members="${i}"]`)!
        .addEventListener("click", () => {
          showMemberEditor(i, roomMembers);
        });

      list.appendChild(groupEl);
    }

    modal.querySelector("#scw-add-group")!.addEventListener("click", () => {
      editingGroups.push({ name: "", members: [] });
      renderModal();
    });

    modal.querySelector("#scw-save-groups")!.addEventListener("click", async () => {
      // 空名グループを除外
      editingGroups = editingGroups.filter((g) => g.name.trim());
      await saveGroups(editingGroups);
      overlay.remove();
    });

    modal.querySelector("#scw-cancel-groups")!.addEventListener("click", () => {
      overlay.remove();
    });
  }

  function showMemberEditor(
    groupIndex: number,
    availableMembers: MemberInfo[],
  ): void {
    const group = editingGroups[groupIndex];
    const selectedIds = new Set(group.members.map((m) => m.accountId));

    const editorEl = document.createElement("div");
    editorEl.style.cssText = `
      margin-top: 8px; padding: 8px;
      border: 1px solid #e0e0e0; border-radius: 6px;
      max-height: 200px; overflow-y: auto;
    `;

    if (availableMembers.length === 0) {
      editorEl.innerHTML = `<div style="font-size: 12px; color: #999; padding: 8px;">
        現在のルームのメンバーが取得できませんでした。<br>
        手動でアカウントIDを追加できます。
      </div>
      <div style="display: flex; gap: 4px; margin-top: 8px;">
        <input type="text" placeholder="アカウントID" id="scw-manual-id"
               style="flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
        <input type="text" placeholder="名前" id="scw-manual-name"
               style="flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
        <button id="scw-manual-add" style="padding: 4px 8px; border: 1px solid #4a9eff; border-radius: 4px; background: white; color: #4a9eff; cursor: pointer; font-size: 12px;">追加</button>
      </div>`;
      editorEl.querySelector("#scw-manual-add")!.addEventListener("click", () => {
        const idInput =
          editorEl.querySelector<HTMLInputElement>("#scw-manual-id")!;
        const nameInput =
          editorEl.querySelector<HTMLInputElement>("#scw-manual-name")!;
        if (idInput.value && nameInput.value) {
          group.members.push({
            accountId: idInput.value,
            name: nameInput.value,
          });
          renderModal();
        }
      });
    } else {
      for (const member of availableMembers) {
        const label = document.createElement("label");
        label.style.cssText = `
          display: flex; align-items: center; gap: 6px;
          padding: 4px 8px; cursor: pointer; font-size: 12px;
          border-radius: 4px;
        `;
        label.innerHTML = `
          <input type="checkbox" ${selectedIds.has(member.accountId) ? "checked" : ""}
                 data-account-id="${member.accountId}" data-account-name="${member.name}">
          <span>${member.name}</span>
        `;
        const cb = label.querySelector<HTMLInputElement>("input")!;
        cb.addEventListener("change", () => {
          if (cb.checked) {
            group.members.push({
              accountId: member.accountId,
              name: member.name,
            });
          } else {
            group.members = group.members.filter(
              (m) => m.accountId !== member.accountId,
            );
          }
        });
        editorEl.appendChild(label);
      }
    }

    // グループカードに追加
    const groupCards = modal.querySelectorAll(
      "#scw-group-list > div",
    );
    const card = groupCards[groupIndex];
    // 既存のエディタがあれば削除
    const existingEditor = card?.querySelector(
      `[data-${EXTENSION_PREFIX}-member-editor]`,
    );
    if (existingEditor) {
      existingEditor.remove();
      return;
    }
    editorEl.setAttribute(`data-${EXTENSION_PREFIX}-member-editor`, "true");
    card?.appendChild(editorEl);
  }

  renderModal();
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

export function injectGroupPicker(toButton: Element): void {
  const parent = toButton.parentElement;
  if (!parent) return;
  if (parent.querySelector(`[data-${EXTENSION_PREFIX}-mention-group]`)) return;

  const btn = document.createElement("button");
  btn.setAttribute(`data-${EXTENSION_PREFIX}-mention-group`, "true");
  btn.title = "グループメンション";
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #f8f8f8;
    cursor: pointer;
    font-size: 14px;
    margin-left: 4px;
    position: relative;
    transition: background 0.15s;
  `;
  btn.textContent = "👥";
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#e8e8e8";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#f8f8f8";
  });

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 既存ドロップダウンを閉じる
    document
      .querySelectorAll(`[data-${EXTENSION_PREFIX}-mention-dropdown]`)
      .forEach((el) => el.remove());

    const groups = await getGroups();
    const dropdown = createDropdown(groups);
    btn.style.position = "relative";
    btn.appendChild(dropdown);
  });

  toButton.insertAdjacentElement("afterend", btn);
}
