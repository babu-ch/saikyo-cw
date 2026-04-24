/**
 * chat-export プラグイン。
 * 現在開いているチャットのルームヘッダーに「CSV出力」ボタンを注入し、
 * クリック時に過去ログを最古まで遡って構造化CSVをダウンロードする。
 */

import type { CwPlugin } from "../types";
import { observeDOM } from "../../../shared/mutation-observer";
import { CW } from "../../../shared/chatwork-selectors";
import { downloadCsv } from "../../../shared/csv-generator";
import { log, error } from "../../../shared/logger";
import {
  extractAllMessages,
  CSV_HEADER,
  messageToRow,
} from "./message-extractor";
import { createProgressOverlay, playChime } from "./overlay";
import { showExportDialog, type DateRange } from "./date-dialog";
import { runScrollLoop } from "./scroll-loop";
import { injectStyles, removeStyles } from "./styles";

const PLUGIN_ID = "chat-export";
const BUTTON_MARKER = "__scw_chat_export_btn";
const BUTTON_CLASS = "scw-chat-export-btn";
const RUNNING_CLASS = "is-running";

const LABEL_IDLE = "📥 CSV出力";
const LABEL_RUNNING = "⏹ 中断";
const TITLE_IDLE = "このチャットをCSVでダウンロード";
const TITLE_RUNNING = "CSV出力を中断（取得済みの分は保存される）";

let observer: MutationObserver | null = null;
let isRunning = false;
let abortSignal: { aborted: boolean } | null = null;

function updateButtonLabels(running: boolean): void {
  document
    .querySelectorAll<HTMLButtonElement>(`.${BUTTON_CLASS}`)
    .forEach((b) => {
      b.textContent = running ? LABEL_RUNNING : LABEL_IDLE;
      b.title = running ? TITLE_RUNNING : TITLE_IDLE;
      b.classList.toggle(RUNNING_CLASS, running);
    });
}

function getRoomName(): string {
  const el = document.querySelector<HTMLElement>(CW.ROOM_TITLE);
  const text = el?.textContent?.trim() || "";
  if (text) return text;
  const m = (document.title || "").match(/Chatwork\s*[-‐―–—]\s*(.+)$/);
  return m?.[1]?.trim() ?? "";
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[\s_]+|[\s_]+$/g, "")
    .slice(0, 80);
}

function buildFilename(range: DateRange, aborted = false): string {
  const safeRoom = sanitizeFilename(getRoomName()) || "chatwork";
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rangePart =
    range.fromEpoch !== null || range.toEpoch !== null
      ? `_${range.fromEpoch ? formatYmd(range.fromEpoch) : "start"}-${range.toEpoch ? formatYmd(range.toEpoch) : "end"}`
      : "";
  const suffix = aborted ? "_partial" : "";
  return `${safeRoom}${rangePart}_${stamp}${suffix}.csv`;
}

function formatYmd(epoch: number): string {
  const d = new Date(epoch * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

async function exportNow(): Promise<void> {
  if (isRunning) {
    // 2度目のクリック = 中断
    if (abortSignal) abortSignal.aborted = true;
    return;
  }

  const opts = await showExportDialog();
  if (!opts) return;
  const range: DateRange = opts.range;

  isRunning = true;
  updateButtonLabels(true);
  const signal = { aborted: false };
  abortSignal = signal;

  const onEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") signal.aborted = true;
  };
  document.addEventListener("keydown", onEsc, true);

  const overlay = createProgressOverlay(() => {
    signal.aborted = true;
  });

  try {
    const result = await runScrollLoop({
      overlay,
      fromEpoch: range.fromEpoch,
      toEpoch: range.toEpoch,
      signal,
    });

    if (result.status === "no-container") {
      overlay.finish("⚠ スクロール領域が見つかりません。チャットを開いて再実行してください", 4500);
      return;
    }

    // どのステータスでも、取得できた分はCSV出力する（中断も含む）
    const all = extractAllMessages();
    const filtered = all.filter((m) => {
      if (range.fromEpoch !== null && m.postedAtEpoch > 0 && m.postedAtEpoch < range.fromEpoch) return false;
      if (range.toEpoch !== null && m.postedAtEpoch > 0 && m.postedAtEpoch > range.toEpoch) return false;
      return true;
    });

    // epoch昇順で安定化（取れなかったものはDOM出現順）
    filtered.sort((a, b) => {
      if (a.postedAtEpoch && b.postedAtEpoch) return a.postedAtEpoch - b.postedAtEpoch;
      return 0;
    });

    const rows: ReadonlyArray<ReadonlyArray<string>> = [
      CSV_HEADER as unknown as ReadonlyArray<string>,
      ...filtered.map(messageToRow),
    ];

    const filename = buildFilename(range, result.status === "aborted");
    if (filtered.length > 0) {
      downloadCsv(filename, rows);
    }

    const statusLabel =
      result.status === "reached-oldest"
        ? "✅ 最古まで到達"
        : result.status === "range-reached"
          ? "✅ 指定期間に到達"
          : result.status === "aborted"
            ? "⏹ 中断（途中までを保存）"
            : "⚠ 上限到達";

    overlay.finish(
      filtered.length
        ? `${statusLabel}（${filtered.length}件 / ${filename}）`
        : `${statusLabel} ※該当メッセージなし`,
      3500,
    );
    if (result.status !== "aborted") playChime();
    log("chat-export: completed", { status: result.status, count: filtered.length, filename });
  } catch (e) {
    error("chat-export: failed", e);
    overlay.finish(`⚠ エラーが発生しました: ${(e as Error).message}`, 5000);
  } finally {
    document.removeEventListener("keydown", onEsc, true);
    isRunning = false;
    abortSignal = null;
    updateButtonLabels(false);
  }
}

function buildButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BUTTON_CLASS;
  if (isRunning) btn.classList.add(RUNNING_CLASS);
  btn.textContent = isRunning ? LABEL_RUNNING : LABEL_IDLE;
  btn.title = isRunning ? TITLE_RUNNING : TITLE_IDLE;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    exportNow().catch((err) => error("chat-export: unexpected", err));
  });
  return btn;
}

function injectButton(titleEl: Element): void {
  const marker = titleEl as unknown as Record<string, unknown>;
  if (marker[BUTTON_MARKER]) return;
  marker[BUTTON_MARKER] = true;

  const btn = buildButton();
  const host = document.createElement("span");
  host.className = "scw-chat-export-host";
  host.style.cssText = "display:inline-flex;align-items:center;";
  host.appendChild(btn);
  titleEl.insertAdjacentElement("afterend", host);
}

function removeAllButtons(): void {
  document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((el) => el.remove());
  document.querySelectorAll(".scw-chat-export-host").forEach((el) => el.remove());
  // markerは解除できないが、再init時はremove済みなので再注入される
}

export const chatExportPlugin: CwPlugin = {
  config: {
    id: PLUGIN_ID,
    name: "チャットCSV出力",
    description:
      "現在開いているチャットを最古まで遡り、CSVとしてダウンロード（必要なら期間指定も可）",
  },
  init() {
    injectStyles();
    observer = observeDOM(CW.ROOM_TITLE, (el) => {
      // タイトル要素が差し替わるたびに再注入
      injectButton(el);
    });
    // ルーム切替でタイトル自体は残るが中身だけ変わるケースにも備える
    // 初回のみ遅延注入もかけておく
    setTimeout(() => {
      const el = document.querySelector(CW.ROOM_TITLE);
      if (el) injectButton(el);
    }, 500);
  },
  destroy() {
    observer?.disconnect();
    observer = null;
    removeAllButtons();
    removeStyles();
    // 実行中なら中断
    if (abortSignal) abortSignal.aborted = true;
  },
};

