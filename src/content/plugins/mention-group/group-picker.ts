import { getPluginConfig } from "../../../shared/storage";

const PLUGIN_ID = "mention-group";
const STYLE_ID = "scw-mention-group-style";
const BTN_ID = "scw-mention-group-btn";
const DROPDOWN_ID = "scw-mention-group-dropdown";
const TOAST_ID = "scw-mention-group-toast";

// chrome.storage のキー（元の拡張と互換性を保つ）
const STORAGE_KEY = "quickMentionGroups";
const ADD_BTN_CLASS = "scw-mg-add-to-group";
const ADD_DROPDOWN_CLASS = "scw-mg-add-dropdown";

interface MemberInfo {
  accountId: string;
  name: string;
}

interface MentionGroup {
  name: string;
  members: MemberInfo[];
}

// 元のchatwork-quick-mentionと同じスタイル
const STYLES = `
  #${BTN_ID} {
    display: inline-block;
    width: 32px;
    height: 32px;
    padding: 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: currentColor;
    cursor: pointer;
    vertical-align: middle;
    transition: background 0.15s;
  }
  #${BTN_ID}:hover {
    background: rgba(0, 0, 0, 0.08);
  }
  #${BTN_ID} svg {
    display: block;
    width: 16px;
    height: 16px;
    fill: #666;
    opacity: 0.8;
  }
  #${BTN_ID}:hover svg {
    fill: #333;
    opacity: 1;
  }

  /* ダークモード */
  body.mainContentArea--dark #${BTN_ID} svg,
  body[data-theme="dark"] #${BTN_ID} svg,
  .darkMode #${BTN_ID} svg {
    fill: #ccc;
  }
  body.mainContentArea--dark #${BTN_ID}:hover svg,
  body[data-theme="dark"] #${BTN_ID}:hover svg,
  .darkMode #${BTN_ID}:hover svg {
    fill: #fff;
  }
  body.mainContentArea--dark #${BTN_ID}:hover,
  body[data-theme="dark"] #${BTN_ID}:hover,
  .darkMode #${BTN_ID}:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  #${DROPDOWN_ID} {
    position: fixed;
    z-index: 100000;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
    padding: 6px;
    min-width: 180px;
    max-width: 260px;
    animation: scw-mg-in 0.12s ease-out;
  }
  @keyframes scw-mg-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .scw-mg-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 9px 14px;
    border: none;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
    color: #333;
    transition: background 0.1s;
    text-align: left;
  }
  .scw-mg-item:hover { background: #e8f0fe; }
  .scw-mg-item-name { font-weight: 500; }
  .scw-mg-item-count {
    font-size: 11px;
    color: #888;
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 10px;
    margin-left: 8px;
  }

  .scw-mg-empty {
    padding: 12px 14px 4px;
    font-size: 12px;
    color: #999;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
  }
  .scw-mg-hint {
    padding: 2px 14px 12px;
    font-size: 11px;
    color: #bbb;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
  }

  #${TOAST_ID} {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(6px);
    z-index: 100001;
    background: #333;
    color: #fff;
    padding: 8px 18px;
    border-radius: 20px;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    opacity: 0;
    transition: all 0.25s ease;
    pointer-events: none;
    white-space: nowrap;
  }
  #${TOAST_ID}.scw-mg-toast-show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* ダークモード */
  body.mainContentArea--dark #${DROPDOWN_ID},
  body[data-theme="dark"] #${DROPDOWN_ID},
  .darkMode #${DROPDOWN_ID} {
    background: #2a2a2a;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08);
  }
  body.mainContentArea--dark .scw-mg-item,
  body[data-theme="dark"] .scw-mg-item,
  .darkMode .scw-mg-item { color: #ddd; }
  body.mainContentArea--dark .scw-mg-item:hover,
  body[data-theme="dark"] .scw-mg-item:hover,
  .darkMode .scw-mg-item:hover { background: #333; }
  body.mainContentArea--dark .scw-mg-item-count,
  body[data-theme="dark"] .scw-mg-item-count,
  .darkMode .scw-mg-item-count { background: #444; color: #aaa; }

  /* プロフィールカード「グループに追加」ボタン — CW既存ボタンと同じ構造 */
  .${ADD_BTN_CLASS} {
    position: relative;
  }

  .${ADD_DROPDOWN_CLASS} {
    position: absolute;
    bottom: 100%;
    left: 0;
    z-index: 100002;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    padding: 4px;
    min-width: 160px;
    margin-bottom: 4px;
    animation: scw-mg-in 0.12s ease-out;
  }
  .${ADD_DROPDOWN_CLASS} button {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    font-size: 12px;
    text-align: left;
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", sans-serif;
  }
  .${ADD_DROPDOWN_CLASS} button:hover { background: #e8f0fe; }
  .${ADD_DROPDOWN_CLASS} .scw-mg-add-new {
    color: #4a90d9;
    border-top: 1px solid #eee;
    margin-top: 2px;
    padding-top: 8px;
  }

  body.mainContentArea--dark .${ADD_DROPDOWN_CLASS},
  body[data-theme="dark"] .${ADD_DROPDOWN_CLASS},
  .darkMode .${ADD_DROPDOWN_CLASS} { background: #2a2a2a; }
  body.mainContentArea--dark .${ADD_DROPDOWN_CLASS} button,
  body[data-theme="dark"] .${ADD_DROPDOWN_CLASS} button,
  .darkMode .${ADD_DROPDOWN_CLASS} button { color: #ddd; }
  body.mainContentArea--dark .${ADD_DROPDOWN_CLASS} button:hover,
  body[data-theme="dark"] .${ADD_DROPDOWN_CLASS} button:hover,
  .darkMode .${ADD_DROPDOWN_CLASS} button:hover { background: #333; }
`;

function buildMentionText(members: MemberInfo[]): string {
  return members.map((m) => `[To:${m.accountId}]${m.name}さん`).join("\n");
}

function findChatInput(): HTMLTextAreaElement | null {
  return document.getElementById("_chatText") as HTMLTextAreaElement | null;
}

function insertMention(members: MemberInfo[]): void {
  const chatInput = findChatInput();
  if (!chatInput) {
    showToast("チャット入力欄が見つかりません");
    return;
  }

  const mentionText = buildMentionText(members);
  const currentText = chatInput.value;
  const start = chatInput.selectionStart || 0;
  const end = chatInput.selectionEnd || 0;
  const before = currentText.substring(0, start);
  const after = currentText.substring(end);
  const insertText = mentionText + "\n";

  chatInput.value = before + insertText + after;
  const newPos = start + insertText.length;
  chatInput.selectionStart = newPos;
  chatInput.selectionEnd = newPos;

  chatInput.dispatchEvent(new Event("input", { bubbles: true }));
  chatInput.dispatchEvent(new Event("change", { bubbles: true }));
  chatInput.focus();

  showToast(`${members.length}人にメンション追加`);
}

function showToast(message: string): void {
  const existing = document.getElementById(TOAST_ID);
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("scw-mg-toast-show"));
  setTimeout(() => {
    toast.classList.remove("scw-mg-toast-show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

function closeDropdown(): void {
  const menu = document.getElementById(DROPDOWN_ID);
  if (menu) menu.remove();
}

function showGroupDropdown(anchorEl: HTMLElement): void {
  closeDropdown();

  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const groups: MentionGroup[] = data[STORAGE_KEY] || [];

    const menu = document.createElement("div");
    menu.id = DROPDOWN_ID;

    if (groups.length === 0) {
      const empty = document.createElement("div");
      empty.className = "scw-mg-empty";
      empty.textContent = "グループ未登録";
      menu.appendChild(empty);
      const hint = document.createElement("div");
      hint.className = "scw-mg-hint";
      hint.textContent = "拡張機能アイコンから設定してください";
      menu.appendChild(hint);
    } else {
      for (const group of groups) {
        const item = document.createElement("button");
        item.className = "scw-mg-item";
        const nameSpan = document.createElement("span");
        nameSpan.className = "scw-mg-item-name";
        nameSpan.textContent = group.name;
        const countSpan = document.createElement("span");
        countSpan.className = "scw-mg-item-count";
        countSpan.textContent = `${group.members.length}人`;
        item.appendChild(nameSpan);
        item.appendChild(countSpan);
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          insertMention(group.members);
          closeDropdown();
        });
        menu.appendChild(item);
      }
    }

    document.body.appendChild(menu);

    // 位置計算
    const btnRect = anchorEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let top = btnRect.bottom + 6;
    let left = btnRect.left;

    if (top + menuRect.height > window.innerHeight - 8) {
      top = btnRect.top - menuRect.height - 6;
    }
    if (left + menuRect.width > window.innerWidth - 8) {
      left = window.innerWidth - menuRect.width - 8;
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    setTimeout(() => {
      document.addEventListener("click", closeDropdown, { once: true });
    }, 10);
  });
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export function injectGroupPicker(): void {
  if (document.getElementById(BTN_ID)) return;

  const toBtn = document.getElementById("_to");
  const emoticonBtn = document.getElementById("_emoticon");
  const anchorBtn = toBtn || emoticonBtn;
  if (!anchorBtn) return;

  const anchorWrapper = anchorBtn.closest("._showDescription");
  if (!anchorWrapper?.parentElement) return;

  injectStyles();

  // ChatWorkと同じ構造でラッパーを作る
  const wrapper = document.createElement("div");
  wrapper.className = "_showDescription";
  wrapper.style.display = "block";

  const innerDiv = document.createElement("div");
  innerDiv.style.display = "inline-block";

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.setAttribute("aria-label", "クイックメンション：登録メンバーに一括メンション");
  btn.innerHTML = `<svg viewBox="0 0 10 10" width="16" height="16" aria-hidden="true">
    <circle cx="3.2" cy="2.5" r="1.5"/>
    <path d="M0.5 7.5C0.5 5.8 1.7 5 3.2 5s2.7.8 2.7 2.5v.5H0.5z"/>
    <circle cx="7" cy="2.5" r="1.3"/>
    <path d="M4.8 7.5C4.8 5.8 5.8 5 7 5s2.2.8 2.2 2.5v.5H4.8z"/>
  </svg>`;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showGroupDropdown(btn);
  });

  innerDiv.appendChild(btn);
  wrapper.appendChild(innerDiv);
  anchorWrapper.parentElement.insertBefore(wrapper, anchorWrapper.nextSibling);
}

// プロフィールカードに「グループに追加」ボタンを注入
export function injectAddToGroupButton(profileBtn: Element): void {
  // button[data-testid="profile-popup_profile-button"][data-aid="xxx"]
  const accountId = profileBtn.getAttribute("data-aid");
  if (!accountId) return;

  // プロフィールカード全体を探す (div[data-aid]が本体)
  // profileBtn → div → div.sc-fjvvzt → div.sc-JrDLc → div[data-aid]
  const card = profileBtn.closest("div[data-aid]")
    ?? profileBtn.parentElement?.parentElement?.parentElement?.parentElement;
  if (!card) return;

  // 既にボタンがあればスキップ
  if (card.querySelector(`.${ADD_BTN_CLASS}`)) return;

  // 名前を取得
  const nameEl = card.querySelector(`[data-testid="profile-popup_user-name"] span[class*="_nameAid"]`);
  const name = nameEl?.textContent?.trim() ?? "";
  if (!name) return;

  // 既存ボタン（「プロフィール」等）のラッパーを見つけて同じ構造で追加
  // profileBtn → div(inner) → div(wrapper) がボタン1つ分の構造
  const existingBtnWrapper = profileBtn.parentElement?.parentElement;
  const buttonRow = existingBtnWrapper?.parentElement;
  if (!existingBtnWrapper || !buttonRow) return;

  injectStyles();

  // 既存ボタンのラッパーをクローンして中身だけ差し替える
  const wrapper = existingBtnWrapper.cloneNode(false) as HTMLElement;
  wrapper.className = existingBtnWrapper.className;
  const inner = document.createElement("div");
  if (profileBtn.parentElement) {
    inner.className = profileBtn.parentElement.className;
  }

  const btn = document.createElement("button");
  // 既存ボタンのclassをコピーしてスタイルを完全に合わせる
  btn.className = `${profileBtn.className} ${ADD_BTN_CLASS}`;
  btn.textContent = "グループに追加";

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // 既存ドロップダウンを閉じる
    document.querySelectorAll(`.${ADD_DROPDOWN_CLASS}`).forEach((el) => el.remove());

    chrome.storage.sync.get(STORAGE_KEY, (data) => {
      const groups: MentionGroup[] = data[STORAGE_KEY] || [];

      const dropdown = document.createElement("div");
      dropdown.className = ADD_DROPDOWN_CLASS;

      if (groups.length === 0) {
        const empty = document.createElement("button");
        empty.className = "scw-mg-add-new";
        empty.textContent = "新規グループを作成";
        empty.addEventListener("click", () => {
          // 新規グループを作ってメンバーを追加
          const groupName = prompt("グループ名を入力");
          if (!groupName) return;
          const newGroup: MentionGroup = {
            name: groupName,
            members: [{ accountId, name }],
          };
          chrome.storage.sync.set({ [STORAGE_KEY]: [newGroup] }, () => {
            showToast(`「${groupName}」に ${name} を追加しました`);
            dropdown.remove();
          });
        });
        dropdown.appendChild(empty);
      } else {
        for (const group of groups) {
          const already = group.members.some((m) => m.accountId === accountId);
          const item = document.createElement("button");
          item.textContent = already ? `${group.name} (追加済み)` : group.name;
          if (already) {
            item.style.color = "#999";
            item.style.cursor = "default";
          }
          item.addEventListener("click", () => {
            if (already) return;
            group.members.push({ accountId, name });
            chrome.storage.sync.set({ [STORAGE_KEY]: groups }, () => {
              showToast(`「${group.name}」に ${name} を追加しました`);
              dropdown.remove();
            });
          });
          dropdown.appendChild(item);
        }

        // 新規グループ追加
        const addNew = document.createElement("button");
        addNew.className = "scw-mg-add-new";
        addNew.textContent = "+ 新規グループに追加";
        addNew.addEventListener("click", () => {
          const groupName = prompt("グループ名を入力");
          if (!groupName) return;
          groups.push({
            name: groupName,
            members: [{ accountId, name }],
          });
          chrome.storage.sync.set({ [STORAGE_KEY]: groups }, () => {
            showToast(`「${groupName}」に ${name} を追加しました`);
            dropdown.remove();
          });
        });
        dropdown.appendChild(addNew);
      }

      wrapper.appendChild(dropdown);

      setTimeout(() => {
        const handler = (ev: MouseEvent) => {
          if (!dropdown.contains(ev.target as Node) && ev.target !== btn) {
            dropdown.remove();
            document.removeEventListener("click", handler);
          }
        };
        document.addEventListener("click", handler);
      }, 10);
    });
  });

  inner.appendChild(btn);
  wrapper.appendChild(inner);
  buttonRow.appendChild(wrapper);
}

export function removeGroupPicker(): void {
  // ボタンとそのラッパーを削除
  const btn = document.getElementById(BTN_ID);
  const wrapper = btn?.closest("._showDescription");
  wrapper?.remove();
  closeDropdown();
  document.getElementById(TOAST_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
}
