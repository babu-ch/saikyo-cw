/**
 * Chatworkのスクロール領域を最古まで遡る実行ループ。
 * 参考実装 chatwork-scroll-to-oldest のrun()ロジックを移植。
 *
 * アルゴリズム要点:
 *  1. scrollTopを0に動かして過去ログ読み込みを誘発
 *  2. background経由のwebRequest監視で「ネット通信中か」を判定
 *  3. 境界マーカー（「Chatworkでつながろう」「コンタクトを追加しました」）の可視化で最古確定
 *  4. ロードマーカー「メッセージを読み込んでいます」検出 + 揺さぶりリトライ
 *  5. 期間指定があるとき、DOM上の最古メッセージがfromEpochより古くなったら早期終了
 */

import { sleep } from "../../../shared/dom-helpers";
import {
  CW,
  CW_SCROLL_CONTAINER_SELECTORS,
} from "../../../shared/chatwork-selectors";
import { extractMessage } from "./message-extractor";
import type { ProgressOverlay } from "./overlay";

export interface ScrollLoopOptions {
  overlay: ProgressOverlay;
  fromEpoch: number | null;
  toEpoch: number | null;
  signal: { aborted: boolean };
}

export interface ScrollLoopResult {
  status: "reached-oldest" | "aborted" | "timeout" | "range-reached" | "no-container";
  messageCount: number;
  batchCount: number;
}

const SCROLL_DELAY = 60;
const POLL_MS = 150;
const AT_TOP_WAIT_MS_FIRST = 15 * 1000;
const AT_TOP_WAIT_MS_RETRY = 10 * 1000;
const BUSY_STARTS_IN_3S = 1;
const DOM_SETTLE_MS = 400;
const HARD_TIMEOUT_MS = 60 * 60 * 1000;

function isScrollable(el: Element | null): boolean {
  if (!el) return false;
  const s = getComputedStyle(el);
  return (
    (s.overflowY === "auto" || s.overflowY === "scroll") &&
    (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight
  );
}

export function findScrollContainer(): HTMLElement | null {
  for (const sel of CW_SCROLL_CONTAINER_SELECTORS) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    for (const el of Array.from(els)) {
      if (isScrollable(el)) return el;
    }
  }
  const anyMsg = document.querySelector(CW.MESSAGE);
  if (anyMsg) {
    let ancestor = anyMsg.parentElement;
    while (ancestor && ancestor !== document.body) {
      const style = getComputedStyle(ancestor);
      if (
        ancestor.scrollHeight > ancestor.clientHeight + 50 &&
        (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "hidden")
      ) {
        return ancestor as HTMLElement;
      }
      ancestor = ancestor.parentElement;
    }
  }
  return null;
}

function countMessages(): number {
  return document.querySelectorAll(CW.MESSAGE).length;
}

function isOldestBoundaryVisible(container: Element): boolean {
  try {
    const snap = document.evaluate(
      ".//*[contains(text(), 'Chatworkでつながろう')" +
        " or contains(text(), 'リンクを共有することで簡単にグループチャットへ招待できます')" +
        " or contains(text(), 'コンタクトを追加しました')]",
      container,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    for (let i = 0; i < snap.snapshotLength; i++) {
      const node = snap.snapshotItem(i) as HTMLElement | null;
      if (!node) continue;
      if (node.closest && node.closest(CW.MESSAGE)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = window.getComputedStyle(node);
      if (style.display === "none") continue;
      if (style.visibility === "hidden") continue;
      if (parseFloat(style.opacity || "1") < 0.01) continue;
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function isLoadingIndicatorVisible(container: Element): boolean {
  try {
    const snap = document.evaluate(
      ".//*[contains(text(), 'メッセージを読み込んで')]",
      container,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    for (let i = 0; i < snap.snapshotLength; i++) {
      const node = snap.snapshotItem(i) as HTMLElement | null;
      if (!node) continue;
      if (node.closest && node.closest(CW.MESSAGE)) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = window.getComputedStyle(node);
      if (style.display === "none") continue;
      if (style.visibility === "hidden") continue;
      if (parseFloat(style.opacity || "1") < 0.01) continue;
      return true;
    }
    return false;
  } catch (_) {
    return false;
  }
}

function tryClickLoadMore(): boolean {
  const candidates = document.querySelectorAll<HTMLElement>(
    "button, a, [role=\"button\"], ._showContextMessage, ._oldMessageGuide",
  );
  for (const el of Array.from(candidates)) {
    const text = (el.textContent || "").trim();
    if (/過去のメッセージ|過去ログ|もっと見る|古いメッセージ|さらに表示/.test(text)) {
      try {
        el.click();
        return true;
      } catch (_) {
        // ignore
      }
    }
  }
  return false;
}

interface NetState {
  startsIn3s: number;
  startsIn1s: number;
  endsIn3s: number;
  msSinceLastStart: number;
  msSinceLastEnd: number;
}

function getNetState(): Promise<NetState> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "cwExport:getNetState" },
      (res: Partial<NetState> & { ok?: boolean } | undefined) => {
        if (chrome.runtime.lastError || !res || res.ok === false) {
          resolve({
            startsIn3s: 0,
            startsIn1s: 0,
            endsIn3s: 0,
            msSinceLastStart: -1,
            msSinceLastEnd: -1,
          });
        } else {
          resolve({
            startsIn3s: res.startsIn3s ?? 0,
            startsIn1s: res.startsIn1s ?? 0,
            endsIn3s: res.endsIn3s ?? 0,
            msSinceLastStart: res.msSinceLastStart ?? -1,
            msSinceLastEnd: res.msSinceLastEnd ?? -1,
          });
        }
      },
    );
  });
}

async function jumpToLatest(
  container: HTMLElement,
  overlay: ProgressOverlay,
  signal: { aborted: boolean },
): Promise<void> {
  const JUMP_MAX_MS = 20 * 1000;
  const QUIET_MS = 800;
  const startedAt = Date.now();
  overlay.setText("📥 最新メッセージまでジャンプ中…");
  container.scrollTop = container.scrollHeight;
  await sleep(300);

  let prevH = container.scrollHeight;
  let quietSince = Date.now();
  while (!signal.aborted && Date.now() - startedAt < JUMP_MAX_MS) {
    await sleep(POLL_MS);
    const h = container.scrollHeight;
    // Chatworkが内部的に位置を戻すことがあるので最下部を維持
    const bottomDelta = h - (container.scrollTop + container.clientHeight);
    if (bottomDelta > 10) {
      container.scrollTop = h;
    }
    if (h !== prevH) {
      prevH = h;
      quietSince = Date.now();
      overlay.setText(`📥 最新メッセージを読み込み中… ${countMessages()}件`);
      continue;
    }
    const net = await getNetState();
    if (Date.now() - quietSince > QUIET_MS && net.startsIn3s === 0) {
      return;
    }
  }
}

function oldestEpochOnDom(): number {
  let min = Number.POSITIVE_INFINITY;
  for (const el of Array.from(document.querySelectorAll(CW.MESSAGE))) {
    const m = extractMessage(el);
    if (m.postedAtEpoch > 0 && m.postedAtEpoch < min) min = m.postedAtEpoch;
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min;
}

export async function runScrollLoop(
  options: ScrollLoopOptions,
): Promise<ScrollLoopResult> {
  const { overlay, fromEpoch, signal } = options;
  const container = findScrollContainer();
  if (!container) {
    return { status: "no-container", messageCount: 0, batchCount: 0 };
  }

  // === フェーズ0: いったん最新メッセージまで移動 ===
  // ボタンを押した時点で画面がチャットの途中を表示していた場合、
  // Chatworkは「画面に見えてる範囲」しかDOMに置かないので、
  // 最新側のメッセージがCSVから抜けてしまう。
  // まず最下部にジャンプし、下向きロードが落ち着くのを待ってから遡行に入る。
  await jumpToLatest(container, overlay, signal);
  if (signal.aborted) {
    return { status: "aborted", messageCount: countMessages(), batchCount: 0 };
  }

  const startedAt = Date.now();
  let batchCount = 0;
  let uiTick = 0;

  const activityLabel = (net: NetState) =>
    `📡 直近3秒: 開始${net.startsIn3s} / 完了${net.endsIn3s}`;

  while (!signal.aborted) {
    if (Date.now() - startedAt > HARD_TIMEOUT_MS) {
      return {
        status: "timeout",
        messageCount: countMessages(),
        batchCount,
      };
    }

    // 期間指定: 取得済みの最古メッセージがfromEpochより古ければ早期終了
    if (fromEpoch !== null) {
      const oldest = oldestEpochOnDom();
      if (oldest > 0 && oldest < fromEpoch) {
        return {
          status: "range-reached",
          messageCount: countMessages(),
          batchCount,
        };
      }
    }

    if (container.scrollTop > 1) {
      if ((uiTick & 3) === 0) {
        overlay.setText(
          `🔄 過去ログを読み込んでいます… ${countMessages()}件（${batchCount}回読込）`,
        );
      }
      uiTick++;
      container.scrollTop = Math.max(
        0,
        container.scrollTop - container.clientHeight * 2,
      );
      await sleep(SCROLL_DELAY);
      continue;
    }

    tryClickLoadMore();

    if (isOldestBoundaryVisible(container)) {
      return {
        status: "reached-oldest",
        messageCount: countMessages(),
        batchCount,
      };
    }

    const heightBefore = container.scrollHeight;
    const countBefore = countMessages();

    const detectLoadStart = async (
      timeoutMs: number,
      phaseLabel: string,
    ): Promise<boolean> => {
      const startAt = Date.now();
      const absoluteMaxAt = startAt + 90 * 1000;
      const STUCK_MS = 10 * 1000;
      const MAX_NUDGES = 3;
      let deadline = startAt + timeoutMs;
      let stuckSince = -1;
      let nudgeCount = 0;
      while (
        Date.now() < deadline &&
        Date.now() < absoluteMaxAt &&
        !signal.aborted
      ) {
        await sleep(POLL_MS);
        const net = await getNetState();
        const grew =
          container.scrollHeight > heightBefore + 50 ||
          countMessages() > countBefore;
        if (grew) return true;
        if (isOldestBoundaryVisible(container)) return false;
        const loading = isLoadingIndicatorVisible(container);
        const nudgeAvailable = nudgeCount < MAX_NUDGES;
        if ((loading && nudgeAvailable) || net.startsIn3s >= BUSY_STARTS_IN_3S) {
          deadline = Math.min(absoluteMaxAt, Date.now() + timeoutMs);
        }
        if (loading && nudgeAvailable) {
          if (stuckSince < 0) stuckSince = Date.now();
          if (Date.now() - stuckSince > STUCK_MS) {
            nudgeCount++;
            overlay.setText(
              `🔄 揺さぶって再試行（${nudgeCount}/${MAX_NUDGES}回目）…`,
            );
            try {
              container.scrollTop = Math.max(container.clientHeight, 200);
              await sleep(400);
              container.scrollTop = 0;
              tryClickLoadMore();
            } catch (_) {
              // ignore
            }
            stuckSince = -1;
            continue;
          }
        } else {
          stuckSince = -1;
        }
        const remainS = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const suffix = loading
          ? nudgeAvailable
            ? " / 🔄 Chatwork読込中"
            : " / 読込表示継続（無視）"
          : "";
        overlay.setText(
          `⏳ ${phaseLabel} あと ${remainS}秒（${countMessages()}件 / ${activityLabel(net)}${suffix}）`,
        );
      }
      return false;
    };

    let loaded = await detectLoadStart(AT_TOP_WAIT_MS_FIRST, "最古か確認中 (1/2)…");
    if (!loaded && !signal.aborted) {
      overlay.setText(
        `🔄 念のためもう一度確認します（2/2）…（${countMessages()}件）`,
      );
      container.scrollTop = container.clientHeight;
      await sleep(250);
      container.scrollTop = 0;
      tryClickLoadMore();
      loaded = await detectLoadStart(AT_TOP_WAIT_MS_RETRY, "最古か確認中 (2/2)…");
    }

    if (signal.aborted) break;
    if (!loaded) {
      return {
        status: "reached-oldest",
        messageCount: countMessages(),
        batchCount,
      };
    }

    // 新規ロードが始まった → scroll位置調整 or DOM落ち着き待ち
    let lastH = container.scrollHeight;
    let lastHeightChangeAt = Date.now();
    const loadCycleStart = Date.now();

    while (!signal.aborted) {
      await sleep(POLL_MS);
      const net = await getNetState();
      const h = container.scrollHeight;
      if (h !== lastH) {
        lastH = h;
        lastHeightChangeAt = Date.now();
      }
      const domQuietFor = Date.now() - lastHeightChangeAt;
      overlay.setText(
        `🔄 読み込み中… ${countMessages()}件 / +${Math.max(0, h - heightBefore)}px / ${activityLabel(net)}`,
      );

      if (container.scrollTop > 1) break;
      if (h > heightBefore + 50 && domQuietFor >= DOM_SETTLE_MS) break;
      if (Date.now() - loadCycleStart > 10 * 60 * 1000) break;
    }

    batchCount++;
  }

  return {
    status: "aborted",
    messageCount: countMessages(),
    batchCount,
  };
}
