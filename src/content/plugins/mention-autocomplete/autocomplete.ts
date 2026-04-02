import { CW } from "../../../shared/chatwork-selectors";
import { setReactInputValue } from "../../../shared/react-input";
import { getApiToken } from "../../../shared/storage";

let memberCache: Record<string, Member[]> = {};
let dropdown: HTMLDivElement | null = null;
let activeTextarea: HTMLTextAreaElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let toastEl: HTMLDivElement | null = null;

interface Member {
  account_id: number;
  name: string;
  avatar_image_url: string;
}

function getRoomId(): string | undefined {
  return location.hash.match(/#!rid(\d+)/)?.[1];
}

function showApiTokenGuide(): void {
  if (toastEl) return;
  toastEl = document.createElement("div");
  toastEl.id = "cw-mention-toast";
  toastEl.innerHTML = `
    <strong>APIトークンが未設定です</strong><br>
    Chatwork右上メニュー → サービス連携 → APIトークン で取得し、<br>
    拡張機能の設定画面で入力してください。
  `;
  document.body.appendChild(toastEl);
  setTimeout(() => {
    toastEl?.remove();
    toastEl = null;
  }, 5000);
}

async function fetchMembers(roomId: string): Promise<Member[]> {
  if (memberCache[roomId]) return memberCache[roomId];
  const token = await getApiToken();
  if (!token) {
    showApiTokenGuide();
    return [];
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "fetchMembers", roomId, token },
      (res) => {
        if (res?.ok) {
          memberCache[roomId] = res.members;
          resolve(res.members);
        } else {
          resolve([]);
        }
      },
    );
  });
}

function getQuery(textarea: HTMLTextAreaElement): string | null {
  const before = textarea.value.slice(0, textarea.selectionStart);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;
  const query = before.slice(atIdx + 1);
  if (/[\s\n]/.test(query)) return null;
  return query;
}

function getCaretRect(textarea: HTMLTextAreaElement) {
  const cs = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.style.cssText = `
    position:absolute; visibility:hidden; overflow:hidden;
    white-space:pre-wrap; word-wrap:break-word;
    width:${textarea.clientWidth}px;
  `;
  const props = [
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
  ] as const;
  for (const p of props) {
    mirror.style.setProperty(
      p.replace(/([A-Z])/g, "-$1").toLowerCase(),
      cs.getPropertyValue(p.replace(/([A-Z])/g, "-$1").toLowerCase()),
    );
  }
  mirror.textContent = textarea.value.slice(0, textarea.selectionStart);
  const caret = document.createElement("span");
  caret.textContent = "\u200b";
  mirror.appendChild(caret);
  document.body.appendChild(mirror);
  const taRect = textarea.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();
  const caretRect = caret.getBoundingClientRect();
  document.body.removeChild(mirror);
  return {
    left: taRect.left + (caretRect.left - mirrorRect.left),
    top: taRect.top + (caretRect.top - mirrorRect.top) - textarea.scrollTop,
    lineHeight: parseFloat(cs.lineHeight) || 20,
  };
}

const PAGE_SIZE = 50;

function createMemberItem(
  member: Member,
  isActive: boolean,
  textarea: HTMLTextAreaElement,
): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "cw-mention-item" + (isActive ? " active" : "");
  item.dataset.accountId = String(member.account_id);
  item.dataset.name = member.name;

  const avatar = document.createElement("img");
  avatar.className = "cw-mention-avatar";
  avatar.src = member.avatar_image_url;
  avatar.onerror = () => {
    avatar.style.visibility = "hidden";
  };

  const name = document.createElement("span");
  name.className = "cw-mention-name";
  name.textContent = member.name;

  item.appendChild(avatar);
  item.appendChild(name);
  item.addEventListener("mousedown", (e) => {
    e.preventDefault();
    insertMention(textarea, member);
  });
  return item;
}

function showDropdown(
  members: Member[],
  query: string,
  textarea: HTMLTextAreaElement,
) {
  hideDropdown();
  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()),
  );
  if (filtered.length === 0) return;

  let loaded = 0;
  let loading = false;

  const dd = document.createElement("div");
  dd.id = "cw-mention-dropdown";
  dropdown = dd;

  function loadMore() {
    if (loading || loaded >= filtered.length) return;
    loading = true;
    const chunk = filtered.slice(loaded, loaded + PAGE_SIZE);
    chunk.forEach((member) => {
      const isActive = loaded === 0 && dd.children.length === 0;
      dd.appendChild(createMemberItem(member, isActive, textarea));
      loaded++;
    });
    loading = false;
  }

  loadMore();

  dd.addEventListener("scroll", () => {
    if (dd.scrollTop + dd.clientHeight >= dd.scrollHeight - 20) {
      loadMore();
    }
  });

  document.body.appendChild(dd);

  const caretPos = getCaretRect(textarea);
  const ddH = dd.offsetHeight;
  const spaceAbove = caretPos.top;
  const spaceBelow =
    window.innerHeight - caretPos.top - caretPos.lineHeight;

  if (spaceAbove >= ddH || spaceAbove > spaceBelow) {
    dd.style.top = caretPos.top - ddH - 4 + "px";
  } else {
    dd.style.top = caretPos.top + caretPos.lineHeight + 4 + "px";
  }
  dd.style.left = Math.max(4, caretPos.left) + "px";
}

export function hideDropdown(): void {
  dropdown?.remove();
  dropdown = null;
}

function moveActive(dir: number) {
  if (!dropdown) return;
  const items = [...dropdown.querySelectorAll<HTMLDivElement>(".cw-mention-item")];
  const cur = items.findIndex((i) => i.classList.contains("active"));
  items[cur]?.classList.remove("active");
  items[(cur + dir + items.length) % items.length]?.classList.add("active");
}

function insertMention(
  textarea: HTMLTextAreaElement,
  member: Pick<Member, "account_id" | "name">,
) {
  const val = textarea.value;
  const pos = textarea.selectionStart;
  const before = val.slice(0, pos);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return;

  const mention = `[To:${member.account_id}]${member.name} `;
  const newVal = val.slice(0, atIdx) + mention + val.slice(pos);
  const newPos = atIdx + mention.length;

  setReactInputValue(textarea, newVal);
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
  hideDropdown();
}

async function onInput(e: Event) {
  const ta = e.target as HTMLElement;
  if (ta.id !== CW.CHAT_INPUT.replace("#", "")) return;
  activeTextarea = ta as HTMLTextAreaElement;
  const query = getQuery(activeTextarea);
  if (query === null) {
    hideDropdown();
    return;
  }
  const roomId = getRoomId();
  if (!roomId) return;
  const members = await fetchMembers(roomId);
  showDropdown(members, query, activeTextarea);
}

function onKeydown(e: KeyboardEvent) {
  if (!dropdown) return;
  // IME変換中のEnterは無視（日本語入力確定と混在させない）
  if (e.isComposing) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveActive(1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    moveActive(-1);
  } else if (e.key === "Enter" || e.key === "Tab") {
    const active = dropdown.querySelector<HTMLDivElement>(
      ".cw-mention-item.active",
    );
    if (active) {
      e.preventDefault();
      e.stopPropagation();
      insertMention(activeTextarea!, {
        account_id: Number(active.dataset.accountId),
        name: active.dataset.name!,
      });
    }
  } else if (e.key === "Escape") {
    hideDropdown();
  }
}

function onClick(e: MouseEvent) {
  if (!dropdown?.contains(e.target as Node)) hideDropdown();
}

function onHashChange() {
  hideDropdown();
}

function injectStyles() {
  styleEl = document.createElement("style");
  styleEl.textContent = `
    #cw-mention-dropdown {
      position: fixed;
      z-index: 10000;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,.15);
      max-height: 260px;
      overflow-y: auto;
      min-width: 200px;
    }
    .cw-mention-item {
      display: flex;
      align-items: center;
      padding: 6px 10px;
      cursor: pointer;
    }
    .cw-mention-item:hover,
    .cw-mention-item.active {
      background: #e8f0fe;
    }
    .cw-mention-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .cw-mention-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #cw-mention-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10001;
      background: #333;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.6;
      box-shadow: 0 4px 12px rgba(0,0,0,.3);
      animation: cw-toast-fade 5s ease-in-out;
    }
    @keyframes cw-toast-fade {
      0% { opacity: 0; transform: translateY(10px); }
      10% { opacity: 1; transform: translateY(0); }
      80% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(styleEl);
}

export function initAutocomplete(): void {
  injectStyles();
  document.addEventListener("input", onInput, true);
  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHashChange);
}

export function destroyAutocomplete(): void {
  hideDropdown();
  memberCache = {};
  activeTextarea = null;
  toastEl?.remove();
  toastEl = null;
  styleEl?.remove();
  styleEl = null;
  document.removeEventListener("input", onInput, true);
  document.removeEventListener("keydown", onKeydown, true);
  document.removeEventListener("click", onClick);
  window.removeEventListener("hashchange", onHashChange);
}