/**
 * Chatwork DOMセレクタの一元管理。
 * CWのDOM構造変更時はここだけ修正すればOK。
 */
export const CW = {
  TIMELINE: "#_timeLine",
  MESSAGE: "[id^=_messageId]",
  MESSAGE_ACTION_NAV: ".chatTimeLineMessageArea__messageActionNav",
  TASK_BUTTON: '[aria-label="タスク"]',
  CHAT_INPUT: "#_chatText",
  CHAT_SEND_BUTTON: "#_sendButton",
  TO_BUTTON: "#_to",
  ROOM_MEMBER_LIST: "#_memberList",
} as const;
