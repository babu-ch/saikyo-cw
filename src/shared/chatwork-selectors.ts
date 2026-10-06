/**
 * Chatwork DOMセレクタの一元管理。
 * CWのDOM構造変更時はここだけ修正すればOK。
 */
export const CW = {
  TIMELINE: "#_timeLine",
  MESSAGE: "[id^=_messageId]",
  MESSAGE_ACTION_NAV: ".messageActionNav",
  TASK_BUTTON: '[aria-label="タスク"]',
  /** メッセージの下に出るリアクション（押すと同じリアクション／自分のものなら取り消し） */
  REACTION_BADGE: '[data-testid="timeline_message_reaction_result-reaction"]',
  /** 自分が押しているリアクション。testidでは見分けられないのでaria-labelで判定する */
  MY_REACTION_BADGE:
    '[data-testid="timeline_message_reaction_result-reaction"][aria-label="このリアクションを取り消す"]',
  CHAT_INPUT: "#_chatText",
  CHAT_SEND_BUTTON: "#_sendButton",
  ENTER_TO_SEND_CHECKBOX: 'input[value="enter-to-send"]',
  TO_BUTTON: "#_to",
  /** TOを押すと開くメンバー一覧（TOボタンの上に開く） */
  TO_LIST: "#_toList",
  TO_LIST_ITEMS: "._cwLTList",
  TO_LIST_SEARCH_AREA: "._cwLTSearchArea",
  ROOM_MEMBER_LIST: "#_memberList",
  ROOM_TITLE: "#_roomTitle",
  CHAT_CONTENT: "#_chatContent",
  MAIN_CONTENT: "#_mainContent",
} as const;

/**
 * チャットのスクロール領域を探すときの候補セレクタ。
 * Chatworkは内部クラス名が頻繁に変わるので複数用意する（上から順に試す）。
 */
export const CW_SCROLL_CONTAINER_SELECTORS = [
  "#_chatContent",
  "._cwLTBody",
  '[class*="timelineBody"]',
  '[class*="TimelineBody"]',
  "#_mainContent",
  ".chatRoomBody",
] as const;
