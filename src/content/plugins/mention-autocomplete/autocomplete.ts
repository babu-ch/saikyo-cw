import { CW } from "../../../shared/chatwork-selectors";
import { setReactInputValue } from "../../../shared/react-input";
import { getApiToken } from "../../../shared/storage";

let memberCache: Record<string, Member[]> = {};
let myAccountId: string | null = null;
let dropdown: HTMLDivElement | null = null;
let activeTextarea: HTMLTextAreaElement | null = null;
let styleEl: HTMLStyleElement | null = null;
let multiSelectMode = false;
const sessionSelected = new Set<string>();
let savedDropdownPos: { top: string; left: string } | null = null;

interface Member {
  account_id: string;
  name: string;
  chatwork_id?: string;
  avatar_image_url: string;
}

function getRoomId(): string | undefined {
  return location.hash.match(/#!rid(\d+)/)?.[1];
}

async function fetchMembers(roomId: string): Promise<Member[]> {
  if (memberCache[roomId]) return memberCache[roomId];
  const token = await getApiToken();
  if (!token) return [];

  const [membersRes, meRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: "fetchMembers", roomId, token }).catch(() => null),
    myAccountId == null
      ? chrome.runtime.sendMessage({ type: "fetchMe", token }).catch(() => null)
      : null,
  ]);

  if (!membersRes?.ok) return [];

  const members: Member[] = membersRes.members.map(
    (m: { account_id: number; name: string; chatwork_id?: string; avatar_image_url: string }) => ({
      ...m,
      account_id: String(m.account_id),
    }),
  );
  memberCache[roomId] = members;
  if (meRes?.ok) myAccountId = String(meRes.me.account_id);
  return members;
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
  item.dataset.accountId = member.account_id;
  item.dataset.name = member.name;

  const avatar = document.createElement("img");
  avatar.className = "cw-mention-avatar";
  avatar.src = member.avatar_image_url;
  avatar.onerror = () => {
    avatar.style.display = "none";
  };

  const name = document.createElement("span");
  name.className = "cw-mention-name";
  name.textContent = member.name;

  item.appendChild(avatar);
  item.appendChild(name);
  item.addEventListener("mousedown", (e) => {
    e.preventDefault();
    insertMention(textarea, member, e.shiftKey);
  });
  return item;
}

function showDropdown(
  members: Member[],
  query: string,
  textarea: HTMLTextAreaElement,
) {
  hideDropdown(false);
  const q = query.toLowerCase();
  const filtered = members.filter(
    (m) =>
      String(m.account_id) !== String(myAccountId) &&
      !sessionSelected.has(m.account_id) &&
      (m.name.toLowerCase().includes(q) ||
        (m.chatwork_id ?? "").toLowerCase().includes(q)),
  );
  if (filtered.length === 0) {
    if (multiSelectMode) resetMultiSelect();
    return;
  }

  let loaded = 0;
  let loading = false;

  const dd = document.createElement("div");
  dd.id = "cw-mention-dropdown";
  dropdown = dd;

  // ヒント表示
  const hint = document.createElement("div");
  hint.className = "cw-mention-hint";
  hint.textContent = "Shift+クリック / Shift+Enter で複数選択";
  dd.appendChild(hint);

  function loadMore() {
    if (loading || loaded >= filtered.length) return;
    loading = true;
    const chunk = filtered.slice(loaded, loaded + PAGE_SIZE);
    chunk.forEach((member) => {
      const isActive =
        loaded === 0 && dd.querySelectorAll(".cw-mention-item").length === 0;
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

  if (multiSelectMode && savedDropdownPos) {
    // 複数選択モード中は初回の位置を維持
    dd.style.top = savedDropdownPos.top;
    dd.style.left = savedDropdownPos.left;
  } else {
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
    savedDropdownPos = { top: dd.style.top, left: dd.style.left };
  }
}

export function hideDropdown(resetAll = true): void {
  dropdown?.remove();
  dropdown = null;
  if (resetAll) resetMultiSelect();
}

function resetMultiSelect(): void {
  multiSelectMode = false;
  sessionSelected.clear();
  savedDropdownPos = null;
}

function moveActive(dir: number) {
  if (!dropdown) return;
  const items = [
    ...dropdown.querySelectorAll<HTMLDivElement>(".cw-mention-item"),
  ];
  const cur = items.findIndex((i) => i.classList.contains("active"));
  items[cur]?.classList.remove("active");
  const next = items[(cur + dir + items.length) % items.length];
  next?.classList.add("active");
  next?.scrollIntoView({ block: "nearest" });
}

function insertMention(
  textarea: HTMLTextAreaElement,
  member: Pick<Member, "account_id" | "name">,
  keepOpen = false,
) {
  const val = textarea.value;
  const pos = textarea.selectionStart;
  const before = val.slice(0, pos);
  const atIdx = before.lastIndexOf("@");
  const hasAtQuery = atIdx !== -1 && !/[\s\n]/.test(before.slice(atIdx + 1));

  const mention = `[To:${member.account_id}]${member.name}\n`;
  let newVal: string;
  let newPos: number;

  if (hasAtQuery) {
    newVal = val.slice(0, atIdx) + mention + val.slice(pos);
    newPos = atIdx + mention.length;
  } else {
    newVal = val.slice(0, pos) + mention + val.slice(pos);
    newPos = pos + mention.length;
  }

  setReactInputValue(textarea, newVal);
  textarea.setSelectionRange(newPos, newPos);

  sessionSelected.add(member.account_id);

  // input発火前にフラグを確定させる（onInputが正しく判定できるよう）
  if (keepOpen) {
    multiSelectMode = true;
    // 現在のドロップダウン位置を保存（再表示時に位置を固定するため）
    if (!savedDropdownPos && dropdown) {
      savedDropdownPos = { top: dropdown.style.top, left: dropdown.style.left };
    }
  } else {
    multiSelectMode = false;
    sessionSelected.clear();
  }

  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();

  if (keepOpen) {
    const roomId = getRoomId();
    if (roomId) {
      fetchMembers(roomId).then((members) =>
        showDropdown(members, "", textarea),
      );
    }
  } else {
    hideDropdown();
  }
}

async function onInput(e: Event) {
  const ta = e.target as HTMLElement;
  if (ta.id !== CW.CHAT_INPUT.replace("#", "")) return;
  activeTextarea = ta as HTMLTextAreaElement;
  const query = getQuery(activeTextarea);

  if (query === null) {
    if (!multiSelectMode) {
      hideDropdown();
      return;
    }
    const roomId = getRoomId();
    if (!roomId) return;
    const members = await fetchMembers(roomId);
    showDropdown(members, "", activeTextarea);
    return;
  }

  const roomId = getRoomId();
  if (!roomId) return;
  const members = await fetchMembers(roomId);
  showDropdown(members, query, activeTextarea);
}

function onKeydown(e: KeyboardEvent) {
  if (!dropdown) return;
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
      insertMention(
        activeTextarea!,
        {
          account_id: active.dataset.accountId!,
          name: active.dataset.name!,
        },
        e.shiftKey,
      );
    }
  } else if (e.key === "Escape") {
    hideDropdown();
    activeTextarea?.focus();
  }
}

function onClick(e: MouseEvent) {
  if (!dropdown?.contains(e.target as Node)) hideDropdown();
}

function onHashChange() {
  memberCache = {};
  hideDropdown();
}

function injectStyles() {
  styleEl = document.createElement("style");
  styleEl.textContent = `
    #cw-mention-dropdown {
      position: fixed;
      z-index: 999999;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
      max-height: 300px;
      overflow-y: auto;
      min-width: 200px;
      padding: 2px 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
    }
    .cw-mention-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      cursor: pointer;
      color: #333;
      transition: background 0.1s;
    }
    .cw-mention-item:hover,
    .cw-mention-item.active {
      background: #f0f0f0;
    }
    .cw-mention-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      background: #e0e0e0;
    }
    .cw-mention-name {
      color: #222;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cw-mention-hint {
      padding: 3px 12px;
      font-size: 11px;
      color: #aaa;
      border-bottom: 1px solid #eee;
      margin-bottom: 1px;
    }
    #cw-mention-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000000;
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
  myAccountId = null;
  activeTextarea = null;
  styleEl?.remove();
  styleEl = null;
  document.removeEventListener("input", onInput, true);
  document.removeEventListener("keydown", onKeydown, true);
  document.removeEventListener("click", onClick);
  window.removeEventListener("hashchange", onHashChange);
}
