import type { CwPlugin } from "../types";
import { CW } from "../../../shared/chatwork-selectors";
import { observeActionNavs } from "../../../shared/mutation-observer";
import { waitForNew } from "../../../shared/dom-helpers";
import { hideUntilClosed } from "../../../shared/cw-popups";
import {
  ACTION_MENU_ITEMS,
  type MoreActionMenuItem,
  type NativeActionMenuItem,
} from "../../../shared/action-menu-items";
import {
  getPluginConfig,
  storageKeyForPlugin,
  type PluginSettings,
} from "../../../shared/storage";

const PLUGIN_ID = "action-menu";
const STYLE_ID = "scw-action-menu-style";
const BTN_CLASS = "scw-action-menu__btn";

export interface ActionMenuConfig {
  /** 非表示にする純正項目のID */
  hiddenItems?: string[];
  /** 「その他」から出してメニューに並べる項目のID */
  shownMoreItems?: string[];
}

type StorageListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

let enabled = false;
// 設定の読み込み中にdestroy→initされたとき、古い読み込み結果を捨てるための世代
let generation = 0;
let config: ActionMenuConfig = {};
let observer: MutationObserver | null = null;
let onStorageChanged: StorageListener | null = null;

// 拡張が足すボタン（my・リンクをコピー）は純正をcloneしていてアイコンが同じなので、scw- のclassで除外する
export function buildHiddenItemsSelector(hiddenItems: readonly string[]): string {
  const hidden = new Set(hiddenItems);
  return ACTION_MENU_ITEMS.filter(
    (item): item is NativeActionMenuItem => item.type === "native" && hidden.has(item.id),
  )
    .map((item) => `${CW.MESSAGE_ACTION_NAV} > li:not([class*="scw-"]):has(use[href="#${item.icon}"])`)
    .join(",\n");
}

// 「その他」のメニュー（ポータルに描画される）。コピーと未読の両方を含むulで見分ける
const MORE_MENU = `ul:not(${CW.MESSAGE_ACTION_NAV}):has(> li use[href="#icon_copy"]):has(> li use[href="#icon_unread"])`;

// 自分の発言のメニューには「返信」の代わりに「編集」がある
const OWN_NAV = `${CW.MESSAGE_ACTION_NAV}:has(use[href="#icon_edit"])`;
const OTHERS_NAV = `${CW.MESSAGE_ACTION_NAV}:not(:has(use[href="#icon_edit"]))`;
const MORE_LI = "li:has(.moreActionButton)";

function isOwnMessage(actionNav: Element): boolean {
  return actionNav.querySelector(':scope > li:not([class*="scw-"]) use[href="#icon_edit"]') !== null;
}

// メニューに出した項目は「その他」の中から隠す。中身が空になる発言では「その他」自体も隠す
export function buildMoreMenuSelector(shownMoreItems: readonly string[]): string {
  const shown = new Set(shownMoreItems);
  const moreItems = ACTION_MENU_ITEMS.filter(
    (item): item is MoreActionMenuItem => item.type === "more",
  );
  const selectors = moreItems
    .filter((item) => shown.has(item.id))
    .map((item) => `${MORE_MENU} > li:has(use[href="#${item.icon}"])`);
  // 他の人の発言の「その他」には自分の発言だけの項目（削除）がない
  if (moreItems.filter((item) => !item.ownOnly).every((item) => shown.has(item.id))) {
    selectors.push(`${OTHERS_NAV} > ${MORE_LI}`);
  }
  if (moreItems.every((item) => shown.has(item.id))) {
    selectors.push(`${OWN_NAV} > ${MORE_LI}`);
  }
  return selectors.join(",\n");
}

// 要素は消さずにCSSで隠すだけにする。ホバーリアクションやクイックタスク、「その他」から出した項目は純正のボタンを押して動くため
function applyHiddenItems(config: ActionMenuConfig): void {
  const selector = [
    buildHiddenItemsSelector(config.hiddenItems ?? []),
    buildMoreMenuSelector(config.shownMoreItems ?? []),
  ]
    .filter(Boolean)
    .join(",\n");
  let style = document.getElementById(STYLE_ID);
  if (!selector) {
    style?.remove();
    return;
  }
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `${selector} {\n  display: none !important;\n}`;
}

function findMoreLi(actionNav: Element): HTMLElement | null {
  return actionNav.querySelector(".moreActionButton")?.closest("li") ?? null;
}

// 隠す側と同じ条件で探す。アクションメニュー（このプラグインが出した「未読」がある）は MORE_MENU で除いている
function findMoreMenus(): NodeListOf<Element> {
  return document.querySelectorAll(MORE_MENU);
}

async function clickMoreMenuItem(actionNav: Element, icon: string): Promise<void> {
  const moreBtn = actionNav.querySelector<HTMLElement>(".moreActionButton");
  if (!moreBtn) return;

  // 押す前から残っている「その他」は別のメッセージのものなので、押した後に開いたものだけを見る
  const menu = await waitForNew(findMoreMenus, () => moreBtn.click());
  const target = menu?.querySelector(`use[href="#${icon}"]`)?.closest("button");
  // 見つからなければメニューを見せたままにして、手で選べるようにする
  if (!menu || !target) return;
  hideUntilClosed(menu);
  target.click();
}

// 純正のボタン（「その他」以外）をcloneしてアイコンとラベルを差し替える
function buildMoreItemButton(
  template: HTMLElement,
  actionNav: Element,
  item: MoreActionMenuItem,
): HTMLElement {
  const li = template.cloneNode(true) as HTMLElement;
  li.classList.add(BTN_CLASS);
  li.querySelector("use")?.setAttribute("href", `#${item.icon}`);
  const label = li.querySelector(".actionLabel");
  if (label) {
    label.textContent = item.label;
  }
  li.querySelector("button")?.setAttribute("title", item.label);
  li.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    void clickMoreMenuItem(actionNav, item.icon);
  });
  return li;
}

export function injectMoreItemButtons(actionNav: Element): void {
  if (!enabled || actionNav.querySelector(`.${BTN_CLASS}`)) return;
  const shown = new Set(config.shownMoreItems ?? []);
  const own = isOwnMessage(actionNav);
  const items = ACTION_MENU_ITEMS.filter(
    (item): item is MoreActionMenuItem =>
      item.type === "more" && shown.has(item.id) && (own || !item.ownOnly),
  );
  if (items.length === 0) return;

  const moreLi = findMoreLi(actionNav);
  const template = actionNav
    .querySelector(':scope > li:not([class*="scw-"]) .actionLabel')
    ?.closest("li");
  if (!moreLi || !template) return;

  for (const item of items) {
    moreLi.insertAdjacentElement("beforebegin", buildMoreItemButton(template, actionNav, item));
  }
}

function applyConfig(next: ActionMenuConfig): void {
  config = next;
  applyHiddenItems(config);
  document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(CW.MESSAGE_ACTION_NAV).forEach(injectMoreItemButtons);
}

export const actionMenuPlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "アクションメニュー",
    description: "メッセージのアクションメニューに出す項目を選ぶ",
    defaultEnabled: true,
    alwaysOn: true,
  },
  init() {
    enabled = true;
    const current = ++generation;
    void getPluginConfig<ActionMenuConfig>(PLUGIN_ID).then((loaded) => {
      if (!enabled || current !== generation) return;
      applyConfig(loaded ?? {});
      observer = observeActionNavs(injectMoreItemButtons);
    });

    onStorageChanged = (changes, area) => {
      if (!enabled || area !== "sync") return;
      const change = changes[storageKeyForPlugin(PLUGIN_ID)];
      if (!change) return;
      const next = (change.newValue as PluginSettings | undefined)?.config as
        | ActionMenuConfig
        | undefined;
      applyConfig(next ?? {});
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
  },
  destroy() {
    enabled = false;
    generation++;
    observer?.disconnect();
    observer = null;
    if (onStorageChanged) {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      onStorageChanged = null;
    }
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll(`.${BTN_CLASS}`).forEach((el) => el.remove());
  },
};
