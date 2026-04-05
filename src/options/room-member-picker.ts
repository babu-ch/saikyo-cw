import { getApiToken } from "../shared/storage";

export interface PickedMember {
  accountId: number;
  name: string;
}

interface RoomMemberPickerOptions {
  /** IDプレフィックス（複数インスタンスの衝突回避） */
  prefix: string;
  /** 初期選択済みのメンバーID */
  selectedIds?: Set<number>;
  /** メンバーが選択/解除されたときのコールバック */
  onChange: (accountId: number, name: string, checked: boolean) => void;
}

// ルーム一覧キャッシュ（ページ内で共有）
let roomsCache: Array<{ room_id: number; name: string; type: string }> | null = null;
// メンバーキャッシュ（ルームID → メンバー一覧）
const memberCache: Record<string, Array<{ account_id: number; name: string }>> = {};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function fetchRooms(): Promise<typeof roomsCache> {
  if (roomsCache) return roomsCache;

  const token = await getApiToken();
  if (!token) return null;

  const res = await chrome.runtime.sendMessage({ type: "fetchRooms", token });
  if (res?.ok && Array.isArray(res.rooms)) {
    roomsCache = res.rooms;
    return roomsCache;
  }
  return null;
}

async function fetchMembers(roomId: string): Promise<Array<{ account_id: number; name: string }> | null> {
  if (memberCache[roomId]) return memberCache[roomId];

  const token = await getApiToken();
  if (!token) return null;

  const res = await chrome.runtime.sendMessage({ type: "fetchMembers", roomId, token });
  if (res?.ok && Array.isArray(res.members)) {
    memberCache[roomId] = res.members;
    return res.members;
  }
  return null;
}

/**
 * ルーム選択 → メンバー一覧チェックボックスの共通UIを生成する。
 * 返却されるHTMLElementをappendすればUIが表示される。
 */
export async function createRoomMemberPicker(opts: RoomMemberPickerOptions): Promise<HTMLElement> {
  const { prefix, selectedIds, onChange } = opts;
  const container = document.createElement("div");

  container.innerHTML = `
    <div style="margin-top: 8px;">
      <label class="api-key-label">ルームを選んでメンバーを表示</label>
      <select id="${prefix}-room-select" class="api-key-input" style="margin-top: 4px;">
        <option value="">-- ルーム読み込み中... --</option>
      </select>
    </div>
    <div style="margin-top: 12px;">
      <label class="api-key-label">メンバーから選択</label>
      <div id="${prefix}-member-list" style="max-height: 200px; overflow-y: auto; margin-top: 4px; border: 1px solid #eee; border-radius: 6px;"></div>
      <p id="${prefix}-member-helper" style="font-size: 11px; color: #888; margin-top: 4px;"></p>
    </div>
  `;

  const roomSelect = container.querySelector<HTMLSelectElement>(`#${prefix}-room-select`)!;

  // ルーム一覧取得
  const rooms = await fetchRooms();
  if (rooms) {
    roomSelect.innerHTML = '<option value="">-- ルームを選択 --</option>';
    const groupRooms = rooms.filter((r) => r.type === "group");
    for (const room of groupRooms) {
      const opt = document.createElement("option");
      opt.value = String(room.room_id);
      opt.textContent = room.name;
      roomSelect.appendChild(opt);
    }
  } else {
    const token = await getApiToken();
    roomSelect.innerHTML = token
      ? '<option value="">-- 取得失敗（APIトークンを確認してください） --</option>'
      : '<option value="">-- APIトークンを先に設定してください --</option>';
  }

  // ルーム選択時にメンバー表示
  roomSelect.addEventListener("change", async () => {
    const roomId = roomSelect.value;
    const memberList = container.querySelector<HTMLElement>(`#${prefix}-member-list`)!;
    const helper = container.querySelector<HTMLElement>(`#${prefix}-member-helper`)!;

    if (!roomId) {
      memberList.innerHTML = "";
      helper.textContent = "";
      return;
    }

    helper.textContent = "読み込み中...";

    const members = await fetchMembers(roomId);
    if (!members) {
      helper.textContent = "メンバーの取得に失敗しました";
      return;
    }

    memberList.innerHTML = "";
    helper.textContent = `${members.length}人`;

    for (const member of members) {
      const isSelected = selectedIds?.has(member.account_id) ?? false;
      const row = document.createElement("label");
      row.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-bottom:1px solid #f0f0f0;font-size:13px;";
      row.innerHTML = `
        <input type="checkbox" ${isSelected ? "checked" : ""} data-aid="${member.account_id}" data-name="${escapeHtml(member.name)}">
        <span><strong>${escapeHtml(member.name)}</strong> <small style="color:#888;">ID: ${member.account_id}</small></span>
      `;

      const cb = row.querySelector<HTMLInputElement>("input")!;
      cb.addEventListener("change", () => {
        onChange(member.account_id, member.name, cb.checked);
      });

      memberList.appendChild(row);
    }
  });

  return container;
}

/**
 * メンバーピッカーのチェック状態を外部から更新する
 */
export function updatePickerSelection(container: HTMLElement, prefix: string, selectedIds: Set<number>): void {
  const memberList = container.querySelector<HTMLElement>(`#${prefix}-member-list`);
  if (!memberList) return;

  memberList.querySelectorAll<HTMLInputElement>("input[data-aid]").forEach((cb) => {
    const aid = Number(cb.dataset.aid);
    cb.checked = selectedIds.has(aid);
  });
}
