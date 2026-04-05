/**
 * Chatwork DOMセレクタの一元管理。
 * CWのDOM構造変更時はここだけ修正すればOK。
 */
export const CW = {
  TIMELINE: "#_timeLine",
  MESSAGE: "[id^=_messageId]",
  MESSAGE_ACTION_NAV: ".messageActionNav",
  TASK_BUTTON: '[aria-label="タスク"]',
  CHAT_INPUT: "#_chatText",
  CHAT_SEND_BUTTON: "#_sendButton",
  ENTER_TO_SEND_CHECKBOX: 'input[value="enter-to-send"]',
  TO_BUTTON: "#_to",
  ROOM_MEMBER_LIST: "#_memberList",
} as const;
