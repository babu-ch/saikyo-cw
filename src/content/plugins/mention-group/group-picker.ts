import { getPluginConfig, setPluginConfig } from "../../../shared/storage";
import { insertAtCursor } from "../../../shared/react-input";

const PLUGIN_ID = "mention-group";
const STYLE_ID = "scw-mention-group-style";
const PICKER_ID = "scw-mention-group-picker";
const DROPDOWN_CLASS = "scw-mention-group__dropdown";
const DROPDOWN_ITEM_CLASS = "scw-mention-group__dropdown-item";
const DROPDOWN_EMPTY_CLASS = "scw-mention-group__dropdown-empty";
const DROPDOWN_MANAGE_CLASS = "scw-mention-group__dropdown-manage";
const OVERLAY_CLASS = "scw-mention-group__overlay";
const MODAL_CLASS = "scw-mention-group__modal";
const MODAL_TITLE_CLASS = "scw-mention-group__modal-title";
const GROUP_CARD_CLASS = "scw-mention-group__card";
const GROUP_HEADER_CLASS = "scw-mention-group__card-header";
const INPUT_CLASS = "scw-mention-group__input";
const BTN_CLASS = "scw-mention-group__btn";
const BTN_PRIMARY_CLASS = "scw-mention-group__btn--primary";
const BTN_DANGER_CLASS = "scw-mention-group__btn--danger";
const BTN_ACTIONS_CLASS = "scw-mention-group__btn-actions";
const MEMBERS_INFO_CLASS = "scw-mention-group__members-info";
const EDIT_LINK_CLASS = "scw-mention-group__edit-link";
const EDITOR_CLASS = "scw-mention-group__editor";
const EDITOR_LABEL_CLASS = "scw-mention-group__editor-label";
const EDITOR_EMPTY_CLASS = "scw-mention-group__editor-empty";
const EDITOR_ROW_CLASS = "scw-mention-group__editor-row";

// ピル型アイコン: 既存拡張のタグ/絵文字と同じトンマナ
// ドロップダウン・モーダル: ダークモード対応
const STYLES = `
  /* ピル: ツールバーに馴染むスタイル */
  #${PICKER_ID} {
    align-items: center;
    cursor: pointer;
    display: flex;
    height: 24px;
    opacity: 0.8;
    margin: 0 4px;
    position: relative;
  }
  #${PICKER_ID}:hover { opacity: 1; }

  #${PICKER_ID} > span {
    -webkit-user-select: none;
    user-select: none;
    align-items: center;
    border-radius: 2px;
    color: #ffffff;
    display: flex;
    font-family: -apple-system, BlinkMacSystemFont, ".SFNSDisplay-Regular",
                 "Helvetica Neue", "Hiragino Sans", "ヒラギノ角ゴシック",
                 Meiryo, "メイリオ", sans-serif;
    font-size: 12px;
    line-height: 12px;
    padding: 2px 4px;
    background-color: #5c8a8a;
  }

  .${DROPDOWN_CLASS} {
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
  }

  .${DROPDOWN_ITEM_CLASS} {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    border-bottom: 1px solid #f0f0f0;
  }
  .${DROPDOWN_ITEM_CLASS}:hover { background: #f0f7ff; }

  .${DROPDOWN_EMPTY_CLASS} { padding: 12px 16px; color: #999; font-size: 13px; }

  .${DROPDOWN_MANAGE_CLASS} {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 12px;
    color: #4a9eff;
    text-align: center;
    background: #fafafa;
  }
  .${DROPDOWN_MANAGE_CLASS}:hover { background: #f0f0f0; }

  .${OVERLAY_CLASS} {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .${MODAL_CLASS} {
    background: white;
    border-radius: 12px;
    padding: 24px;
    width: 480px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    color: #333;
  }

  .${MODAL_TITLE_CLASS} { margin: 0 0 16px; font-size: 18px; }

  .${GROUP_CARD_CLASS} {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .${GROUP_HEADER_CLASS} {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .${INPUT_CLASS} {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    background: white;
    color: #333;
  }

  .${BTN_CLASS} {
    padding: 8px 16px;
    border: 1px solid #ccc;
    border-radius: 6px;
    background: white;
    color: #666;
    cursor: pointer;
    font-size: 13px;
  }
  .${BTN_CLASS}:hover { background: #f0f0f0; }

  .${BTN_PRIMARY_CLASS} {
    border-color: #4a9eff;
    background: #4a9eff;
    color: white;
  }
  .${BTN_PRIMARY_CLASS}:hover { background: #3a8eef; }

  .${BTN_DANGER_CLASS} {
    padding: 4px 8px;
    border-color: #e66;
    color: #e66;
    font-size: 12px;
  }
  .${BTN_DANGER_CLASS}:hover { background: #fff0f0; }

  .${BTN_ACTIONS_CLASS} {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }

  .${MEMBERS_INFO_CLASS} { font-size: 12px; color: #888; margin-bottom: 4px; }
  .${EDIT_LINK_CLASS} { font-size: 12px; color: #4a9eff; cursor: pointer; }
  .${EDIT_LINK_CLASS}:hover { text-decoration: underline; }

  .${EDITOR_CLASS} {
    margin-top: 8px;
    padding: 8px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    max-height: 200px;
    overflow-y: auto;
  }

  .${EDITOR_LABEL_CLASS} {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    cursor: pointer;
    font-size: 12px;
    border-radius: 4px;
  }
  .${EDITOR_LABEL_CLASS}:hover { background: #f5f5f5; }

  .${EDITOR_EMPTY_CLASS} { font-size: 12px; color: #999; padding: 8px; }
  .${EDITOR_ROW_CLASS} { display: flex; gap: 4px; margin-top: 8px; }

  /* ダークモード */
  body.mainContentArea--dark .${DROPDOWN_CLASS},
  body[data-theme="dark"] .${DROPDOWN_CLASS},
  .darkMode .${DROPDOWN_CLASS} {
    background: #2a2a2a; border-color: #444;
  }
  body.mainContentArea--dark .${DROPDOWN_ITEM_CLASS},
  body[data-theme="dark"] .${DROPDOWN_ITEM_CLASS},
  .darkMode .${DROPDOWN_ITEM_CLASS} {
    border-bottom-color: #3a3a3a; color: #ddd;
  }
  body.mainContentArea--dark .${DROPDOWN_ITEM_CLASS}:hover,
  body[data-theme="dark"] .${DROPDOWN_ITEM_CLASS}:hover,
  .darkMode .${DROPDOWN_ITEM_CLASS}:hover { background: #333; }
  body.mainContentArea--dark .${DROPDOWN_MANAGE_CLASS},
  body[data-theme="dark"] .${DROPDOWN_MANAGE_CLASS},
  .darkMode .${DROPDOWN_MANAGE_CLASS} { background: #333; }
  body.mainContentArea--dark .${MODAL_CLASS},
  body[data-theme="dark"] .${MODAL_CLASS},
  .darkMode .${MODAL_CLASS} { background: #2a2a2a; color: #ddd; }
  body.mainContentArea--dark .${GROUP_CARD_CLASS},
  body[data-theme="dark"] .${GROUP_CARD_CLASS},
  .darkMode .${GROUP_CARD_CLASS} { border-color: #444; }
  body.mainContentArea--dark .${INPUT_CLASS},
  body[data-theme="dark"] .${INPUT_CLASS},
  .darkMode .${INPUT_CLASS} { background: #333; border-color: #555; color: #ddd; }
  body.mainContentArea--dark .${BTN_CLASS},
  body[data-theme="dark"] .${BTN_CLASS},
  .darkMode .${BTN_CLASS} { background: #3a3a3a; border-color: #555; color: #ccc; }
  body.mainContentArea--dark .${BTN_CLASS}:hover,
  body[data-theme="dark"] .${BTN_CLASS}:hover,
  .darkMode .${BTN_CLASS}:hover { background: #4a4a4a; }
  body.mainContentArea--dark .${BTN_PRIMARY_CLASS},
  body[data-theme="dark"] .${BTN_PRIMARY_CLASS},
  .darkMode .${BTN_PRIMARY_CLASS} { background: #3a8eef; border-color: #3a8eef; color: white; }
  body.mainContentArea--dark .${EDITOR_CLASS},
  body[data-theme="dark"] .${EDITOR_CLASS},
  .darkMode .${EDITOR_CLASS} { border-color: #444; }
  body.mainContentArea--dark .${EDITOR_LABEL_CLASS}:hover,
  body[data-theme="dark"] .${EDITOR_LABEL_CLASS}:hover,
  .darkMode .${EDITOR_LABEL_CLASS}:hover { background: #3a3a3a; }
`;

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

function insertMention(members: MemberInfo[]): void {
  const chatInput = document.querySelector("#_chatText") as HTMLTextAreaElement | null;
  if (!chatInput) return;
  const text = members.map((m) => `[To:${m.accountId}]${m.name}さん`).join(" ");
  chatInput.focus();
  insertAtCursor(chatInput, text + "\n");
}

function createDropdown(groups: MentionGroup[]): HTMLElement {
  const dropdown = document.createElement("div");
  dropdown.className = DROPDOWN_CLASS;

  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = DROPDOWN_EMPTY_CLASS;
    empty.textContent = "グループ未登録";
    dropdown.appendChild(empty);
  } else {
    for (const group of groups) {
      const item = document.createElement("div");
      item.className = DROPDOWN_ITEM_CLASS;
      item.textContent = `${group.name} (${group.members.length}人)`;
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        insertMention(group.members);
        dropdown.remove();
      });
      dropdown.appendChild(item);
    }
  }

  const manageItem = document.createElement("div");
  manageItem.className = DROPDOWN_MANAGE_CLASS;
  manageItem.textContent = "グループを管理...";
  manageItem.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.remove();
    showGroupManager();
  });
  dropdown.appendChild(manageItem);

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
  document.querySelectorAll(
    '#_memberList li[data-account-id], [data-testid="room-member-list"] li[data-account-id]',
  ).forEach((el) => {
    const accountId = el.getAttribute("data-account-id");
    const name =
      el.querySelector(".roomMemberListItem__name")?.textContent?.trim() ??
      el.getAttribute("data-account-name") ?? "";
    if (accountId) members.push({ accountId, name });
  });
  return members;
}

async function showGroupManager(): Promise<void> {
  const existing = document.querySelector(`.${OVERLAY_CLASS}`);
  if (existing) { existing.remove(); return; }

  const groups = await getGroups();
  const roomMembers = getCurrentRoomMembers();

  const overlay = document.createElement("div");
  overlay.className = OVERLAY_CLASS;
  const modal = document.createElement("div");
  modal.className = MODAL_CLASS;

  let editingGroups = JSON.parse(JSON.stringify(groups)) as MentionGroup[];

  function renderModal(): void {
    modal.innerHTML = `
      <h2 class="${MODAL_TITLE_CLASS}">メンショングループ管理</h2>
      <div id="scw-group-list"></div>
      <div class="${BTN_ACTIONS_CLASS}">
        <button id="scw-add-group" class="${BTN_CLASS}">+ グループ追加</button>
        <div style="flex: 1;"></div>
        <button id="scw-save-groups" class="${BTN_CLASS} ${BTN_PRIMARY_CLASS}">保存</button>
        <button id="scw-cancel-groups" class="${BTN_CLASS}">キャンセル</button>
      </div>
    `;
    const list = modal.querySelector("#scw-group-list")!;

    for (let i = 0; i < editingGroups.length; i++) {
      const group = editingGroups[i];
      const groupEl = document.createElement("div");
      groupEl.className = GROUP_CARD_CLASS;
      groupEl.innerHTML = `
        <div class="${GROUP_HEADER_CLASS}">
          <input type="text" value="${group.name}" placeholder="グループ名" data-group-index="${i}" class="${INPUT_CLASS}">
          <button data-delete-group="${i}" class="${BTN_CLASS} ${BTN_DANGER_CLASS}">削除</button>
        </div>
        <div class="${MEMBERS_INFO_CLASS}">メンバー: ${group.members.map((m) => m.name).join(", ") || "未設定"}</div>
        <div class="${EDIT_LINK_CLASS}" data-edit-members="${i}">メンバーを編集...</div>
      `;
      groupEl.querySelector<HTMLInputElement>("input")!.addEventListener("input", (ev) => {
        editingGroups[i].name = (ev.target as HTMLInputElement).value;
      });
      groupEl.querySelector(`[data-delete-group="${i}"]`)!.addEventListener("click", () => {
        editingGroups.splice(i, 1); renderModal();
      });
      groupEl.querySelector(`[data-edit-members="${i}"]`)!.addEventListener("click", () => {
        showMemberEditor(groupEl, i, roomMembers);
      });
      list.appendChild(groupEl);
    }

    modal.querySelector("#scw-add-group")!.addEventListener("click", () => {
      editingGroups.push({ name: "", members: [] }); renderModal();
    });
    modal.querySelector("#scw-save-groups")!.addEventListener("click", async () => {
      editingGroups = editingGroups.filter((g) => g.name.trim());
      await saveGroups(editingGroups); overlay.remove();
    });
    modal.querySelector("#scw-cancel-groups")!.addEventListener("click", () => overlay.remove());
  }

  function showMemberEditor(card: Element, groupIndex: number, availableMembers: MemberInfo[]): void {
    const group = editingGroups[groupIndex];
    const existing = card.querySelector(`.${EDITOR_CLASS}`);
    if (existing) { existing.remove(); return; }

    const selectedIds = new Set(group.members.map((m) => m.accountId));
    const editorEl = document.createElement("div");
    editorEl.className = EDITOR_CLASS;

    if (availableMembers.length === 0) {
      editorEl.innerHTML = `
        <div class="${EDITOR_EMPTY_CLASS}">現在のルームのメンバーが取得できませんでした。<br>手動でアカウントIDを追加できます。</div>
        <div class="${EDITOR_ROW_CLASS}">
          <input type="text" placeholder="アカウントID" id="scw-manual-id" class="${INPUT_CLASS}">
          <input type="text" placeholder="名前" id="scw-manual-name" class="${INPUT_CLASS}">
          <button id="scw-manual-add" class="${BTN_CLASS}">追加</button>
        </div>`;
      editorEl.querySelector("#scw-manual-add")!.addEventListener("click", () => {
        const idInput = editorEl.querySelector<HTMLInputElement>("#scw-manual-id")!;
        const nameInput = editorEl.querySelector<HTMLInputElement>("#scw-manual-name")!;
        if (idInput.value && nameInput.value) {
          group.members.push({ accountId: idInput.value, name: nameInput.value });
          renderModal();
        }
      });
    } else {
      for (const member of availableMembers) {
        const label = document.createElement("label");
        label.className = EDITOR_LABEL_CLASS;
        label.innerHTML = `<input type="checkbox" ${selectedIds.has(member.accountId) ? "checked" : ""} data-account-id="${member.accountId}"><span>${member.name}</span>`;
        label.querySelector<HTMLInputElement>("input")!.addEventListener("change", (ev) => {
          if ((ev.target as HTMLInputElement).checked) {
            group.members.push({ accountId: member.accountId, name: member.name });
          } else {
            group.members = group.members.filter((m) => m.accountId !== member.accountId);
          }
        });
        editorEl.appendChild(label);
      }
    }
    card.appendChild(editorEl);
  }

  renderModal();
  overlay.appendChild(modal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export function injectGroupPicker(): void {
  if (document.getElementById(PICKER_ID)) return;

  // Input Toolsの<ul>があればそこに追加、なければアイコン列<ul>の後に独立して配置
  const targetUl = document.getElementById("scw-input-tools-icons");
  const emoticon = document.querySelector("#_emoticon");
  const iconsUl = emoticon?.closest("ul");

  if (!targetUl && !iconsUl) return;

  injectStyles();

  const li = document.createElement("li");
  li.id = PICKER_ID;
  li.className = "_showDescription";
  li.setAttribute("role", "button");
  li.setAttribute("aria-label", "グループメンション：登録済みグループのメンバーにまとめてTOを付けます");

  const span = document.createElement("span");
  span.textContent = "group";
  li.appendChild(span);

  li.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll(`.${DROPDOWN_CLASS}`).forEach((el) => el.remove());
    const groups = await getGroups();
    const dropdown = createDropdown(groups);
    li.appendChild(dropdown);
  });

  if (targetUl) {
    targetUl.appendChild(li);
  } else if (iconsUl) {
    // Input Toolsが無い場合、独立した<ul>を作成
    const ul = document.createElement("ul");
    ul.style.cssText = "display: flex; align-items: center;";
    ul.appendChild(li);
    iconsUl.insertAdjacentElement("afterend", ul);
  }
}

export function removeGroupPicker(): void {
  const picker = document.getElementById(PICKER_ID);
  // 独立<ul>に入っている場合はulごと消す
  if (picker?.parentElement?.id !== "scw-input-tools-icons") {
    picker?.parentElement?.remove();
  } else {
    picker?.remove();
  }
  document.querySelectorAll(`.${DROPDOWN_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => el.remove());
  document.getElementById(STYLE_ID)?.remove();
}
