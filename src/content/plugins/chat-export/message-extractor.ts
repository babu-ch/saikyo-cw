/**
 * Chatworkのメッセージ要素(`div[id^=_messageId]`)からCSV用のフィールドを抽出する。
 * ChatworkはDOM構造が変わりやすいので、値が取れなければ空文字にフォールバックする。
 */

import { CW } from "../../../shared/chatwork-selectors";

export interface ExtractedMessage {
  messageId: string;
  postedAt: string;       // ISO8601（取れなければ空）
  postedAtEpoch: number;  // unix秒（取れなければ0）
  postedAtText: string;   // 画面表示の日時テキスト（取れなければ空）
  edited: boolean;
  accountId: string;      // 送信者アカウントID（取れなければ空）
  userName: string;       // 送信者表示名
  body: string;           // 本文（生Chatworkタグ保持）
  bodyText: string;       // 生タグを除去した純テキスト
  replyToMessageId: string; // 返信先メッセージID
  replyToAccountId: string; // 返信先アカウントID
  hasFile: boolean;
  reactions: string;      // "like:3;done:1" 形式
  permalink: string;      // メッセージへのURL
}

const CW_BASE = "https://www.chatwork.com/";

function idFromElement(el: Element): string {
  // id="_messageId123456" 形式 or data-mid属性
  const dataMid = el.getAttribute("data-mid");
  if (dataMid) return dataMid;
  const m = (el.id || "").match(/_messageId(\d+)/);
  return m?.[1] ?? "";
}

function roomIdFromElement(el: Element): string {
  const rid = el.getAttribute("data-rid");
  if (rid) return rid;
  const m = (window.location.hash || "").match(/rid(\d+)/);
  return m?.[1] ?? "";
}

function accountIdFromElement(el: Element): string {
  const direct = el.getAttribute("data-aid");
  if (direct) return direct;
  // フォールバック: 子要素のdata-aidやsrcから拾う
  const inner = el.querySelector<HTMLElement>("[data-aid]");
  if (inner) return inner.getAttribute("data-aid") ?? "";
  const img = el.querySelector<HTMLImageElement>("img[src*='ico_avatar']");
  const src = img?.src ?? "";
  // URL内の数値IDっぽい最後の数字を拾う
  const idMatch = src.match(/(\d+)(?:\.|_|\/)/);
  return idMatch?.[1] ?? "";
}

function userNameFromElement(el: Element): string {
  const candidates = [
    "[data-testid='speaker-name']",
    ".speakerName",
    ".speaker",
    "[class*='speakerName']",
    "[class*='Speaker']",
  ];
  for (const sel of candidates) {
    const node = el.querySelector<HTMLElement>(sel);
    const text = node?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function timestampFromElement(el: Element): {
  iso: string;
  epoch: number;
  text: string;
} {
  // Chatworkはtime要素またはdata-timestamp属性に保持することが多い
  const time = el.querySelector<HTMLElement>("time[datetime]");
  if (time) {
    const dt = time.getAttribute("datetime") ?? "";
    const text = time.textContent?.trim() ?? "";
    const epoch = dt ? Math.floor(new Date(dt).getTime() / 1000) : 0;
    return { iso: dt, epoch, text };
  }
  const withTs = el.querySelector<HTMLElement>("[data-tm]");
  if (withTs) {
    const tm = Number(withTs.getAttribute("data-tm") ?? 0);
    if (tm > 0) {
      const ms = tm < 1e12 ? tm * 1000 : tm;
      return {
        iso: new Date(ms).toISOString(),
        epoch: Math.floor(ms / 1000),
        text: withTs.textContent?.trim() ?? "",
      };
    }
  }
  const timestampEl = el.querySelector<HTMLElement>(
    "[class*='timestamp'], [class*='Timestamp'], .timeStamp, ._timeStamp",
  );
  const text = timestampEl?.textContent?.trim() ?? "";
  return { iso: "", epoch: 0, text };
}

function editedFromElement(el: Element): boolean {
  return !!el.querySelector(
    "[class*='edited'], [class*='Edited'], .messageEdited",
  );
}

function bodyFromElement(el: Element): { raw: string; text: string } {
  // data-message属性があれば生本文（[To:] [rp] などのChatworkタグ込み）
  const rawAttr = el.getAttribute("data-message");
  if (rawAttr) {
    return { raw: rawAttr, text: stripCwTags(rawAttr) };
  }
  // フォールバック: 本文領域のテキスト
  const bodyEl =
    el.querySelector<HTMLElement>("pre") ||
    el.querySelector<HTMLElement>("[class*='messageBody']") ||
    el.querySelector<HTMLElement>("[class*='MessageBody']");
  if (bodyEl) {
    const spans = bodyEl.querySelectorAll("span");
    const text = spans.length
      ? Array.from(spans).map((s) => (s as HTMLElement).innerText).join("\n")
      : bodyEl.innerText;
    return { raw: text, text };
  }
  return { raw: "", text: "" };
}

function stripCwTags(raw: string): string {
  return raw
    .replace(/\[rp[^\]]*\][\s\S]*?\[\/rp\]/g, " ")
    .replace(/\[qt\][\s\S]*?\[\/qt\]/g, " ")
    .replace(/\[To:\d+\](?:\s*\S+さん)?/g, " ")
    .replace(/\[info\]/g, " ")
    .replace(/\[\/info\]/g, " ")
    .replace(/\[title\][\s\S]*?\[\/title\]/g, " ")
    .replace(/\[code\]/g, " ")
    .replace(/\[\/code\]/g, " ")
    .replace(/\[hr\]/g, " ")
    .replace(/\[piconname:\d+\]/g, " ")
    .replace(/\[picon:\d+\]/g, " ")
    .replace(/\[dtext:[^\]]+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function replyInfoFromBody(raw: string): { mid: string; aid: string } {
  // [rp aid=123 to=456-789] 形式
  const m = raw.match(/\[rp\s+aid=(\d+)\s+to=(\d+)-(\d+)\]/);
  if (!m) return { mid: "", aid: "" };
  return { aid: m[1] ?? "", mid: m[3] ?? "" };
}

function hasFileFromElement(el: Element): boolean {
  return !!el.querySelector(
    "[class*='messageFile'], [class*='MessageFile'], [class*='fileTitle']",
  );
}

function reactionsFromElement(el: Element): string {
  // `[class*='reaction']` の中に count と絵文字/種類が含まれるはず
  const root = el.querySelector("[class*='reactionList'], [class*='ReactionList']");
  if (!root) return "";
  const items = root.querySelectorAll<HTMLElement>(
    "[class*='reactionItem'], [class*='ReactionItem'], [data-testid*='reaction']",
  );
  const parts: string[] = [];
  for (const item of items) {
    const key =
      item.getAttribute("data-reaction-type") ||
      item.getAttribute("data-emoji") ||
      item.getAttribute("aria-label") ||
      item.querySelector<HTMLElement>("[class*='reactionName']")?.textContent?.trim() ||
      "";
    const countText = item.querySelector<HTMLElement>(
      "[class*='reactionCount'], [class*='Count']",
    )?.textContent?.trim() || "";
    if (!key && !countText) continue;
    parts.push(`${key || "?"}:${countText || "?"}`);
  }
  return parts.join(";");
}

export function extractMessage(el: Element): ExtractedMessage {
  const messageId = idFromElement(el);
  const roomId = roomIdFromElement(el);
  const { raw, text } = bodyFromElement(el);
  const ts = timestampFromElement(el);
  const reply = replyInfoFromBody(raw);
  return {
    messageId,
    postedAt: ts.iso,
    postedAtEpoch: ts.epoch,
    postedAtText: ts.text,
    edited: editedFromElement(el),
    accountId: accountIdFromElement(el),
    userName: userNameFromElement(el),
    body: raw,
    bodyText: text,
    replyToMessageId: reply.mid,
    replyToAccountId: reply.aid,
    hasFile: hasFileFromElement(el),
    reactions: reactionsFromElement(el),
    permalink:
      messageId && roomId
        ? `${CW_BASE}#!rid${roomId}-${messageId}`
        : "",
  };
}

export function extractAllMessages(): ExtractedMessage[] {
  const els = document.querySelectorAll(CW.MESSAGE);
  const list: ExtractedMessage[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(els)) {
    const m = extractMessage(el);
    if (!m.messageId || seen.has(m.messageId)) continue;
    seen.add(m.messageId);
    list.push(m);
  }
  return list;
}

export const CSV_HEADER = [
  "message_id",
  "posted_at",
  "posted_at_text",
  "edited",
  "account_id",
  "user_name",
  "body",
  "body_text",
  "reply_to_message_id",
  "reply_to_account_id",
  "has_file",
  "reactions",
  "permalink",
] as const;

export function messageToRow(m: ExtractedMessage): ReadonlyArray<string> {
  return [
    m.messageId,
    m.postedAt,
    m.postedAtText,
    String(m.edited),
    m.accountId,
    m.userName,
    m.body,
    m.bodyText,
    m.replyToMessageId,
    m.replyToAccountId,
    String(m.hasFile),
    m.reactions,
    m.permalink,
  ];
}
