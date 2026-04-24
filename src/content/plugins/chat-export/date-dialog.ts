/**
 * CSV出力ダイアログ。
 * 通常ユーザーは「ダウンロード」を押すだけで全期間が出力される。
 * 「期間を指定する」チェックを入れると、開始日・終了日の入力欄が現れる。
 *
 * スタイルは chat-export/styles.ts のCSSに集約している（ダークモード対応のため）。
 */

export interface DateRange {
  fromEpoch: number | null;
  toEpoch: number | null;
}

export interface ExportOptions {
  range: DateRange;
}

const DIALOG_ID = "scw-export-dialog";

export function showExportDialog(): Promise<ExportOptions | null> {
  return new Promise((resolve) => {
    document.getElementById(DIALOG_ID)?.remove();

    const overlay = document.createElement("div");
    overlay.id = DIALOG_ID;
    overlay.className = "scw-export-dialog";

    const card = document.createElement("div");
    card.className = "scw-export-dialog__card";

    const title = document.createElement("div");
    title.className = "scw-export-dialog__title";
    title.textContent = "チャットをCSVでダウンロード";
    card.appendChild(title);

    const desc = document.createElement("div");
    desc.className = "scw-export-dialog__desc";
    desc.textContent = [
      "現在のチャットを最古までさかのぼってCSV出力します。",
      "開始時にいったん最新メッセージまで移動してから過去へさかのぼります。",
      "大きいチャットほど時間がかかりますが、途中で中断してもそこまでのCSVが保存されます。",
    ].join("\n");
    card.appendChild(desc);

    const notice = document.createElement("div");
    notice.className = "scw-export-dialog__notice";
    notice.textContent = [
      "⚠ 処理中はこのタブをアクティブに保ってください。",
      "別タブに切り替えると処理が大きく遅くなったり、途中で終わってしまうことがあります。",
    ].join("\n");
    card.appendChild(notice);

    const rangeToggle = document.createElement("label");
    rangeToggle.className = "scw-export-dialog__toggle";
    const rangeCheck = document.createElement("input");
    rangeCheck.type = "checkbox";
    const rangeLabel = document.createElement("span");
    rangeLabel.textContent = "期間を指定する";
    rangeToggle.appendChild(rangeCheck);
    rangeToggle.appendChild(rangeLabel);
    card.appendChild(rangeToggle);

    const rangeWrap = document.createElement("div");
    rangeWrap.className = "scw-export-dialog__range";
    card.appendChild(rangeWrap);

    const mkRow = (labelText: string) => {
      const row = document.createElement("label");
      row.className = "scw-export-dialog__row";
      const lbl = document.createElement("span");
      lbl.textContent = labelText;
      const input = document.createElement("input");
      input.type = "date";
      row.appendChild(lbl);
      row.appendChild(input);
      rangeWrap.appendChild(row);
      return input;
    };
    const fromInput = mkRow("開始日（この日以降）");
    const toInput = mkRow("終了日（この日以前）");
    const hint = document.createElement("div");
    hint.className = "scw-export-dialog__hint";
    hint.textContent = "どちらか片方だけの指定もOK。空欄なら制限なし。";
    rangeWrap.appendChild(hint);

    rangeCheck.addEventListener("change", () => {
      rangeWrap.classList.toggle("is-open", rangeCheck.checked);
    });

    const warn = document.createElement("div");
    warn.className = "scw-export-dialog__warn";
    card.appendChild(warn);

    const btnRow = document.createElement("div");
    btnRow.className = "scw-export-dialog__actions";
    card.appendChild(btnRow);

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "scw-export-dialog__btn";
    cancelBtn.textContent = "キャンセル";
    btnRow.appendChild(cancelBtn);

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "scw-export-dialog__btn scw-export-dialog__btn--primary";
    okBtn.textContent = "ダウンロード";
    btnRow.appendChild(okBtn);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.removeEventListener("keydown", onKey, true);
      overlay.remove();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
        resolve(null);
      }
      if (
        e.key === "Enter" &&
        (e.target as HTMLElement).tagName !== "BUTTON"
      ) {
        e.preventDefault();
        okBtn.click();
      }
    };
    document.addEventListener("keydown", onKey, true);

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    okBtn.addEventListener("click", () => {
      let fromEpoch: number | null = null;
      let toEpoch: number | null = null;
      if (rangeCheck.checked) {
        const from = fromInput.value;
        const to = toInput.value;
        if (from) {
          const d = new Date(`${from}T00:00:00`);
          if (isNaN(d.getTime())) {
            warn.textContent = "開始日の形式が不正です";
            return;
          }
          fromEpoch = Math.floor(d.getTime() / 1000);
        }
        if (to) {
          const d = new Date(`${to}T23:59:59`);
          if (isNaN(d.getTime())) {
            warn.textContent = "終了日の形式が不正です";
            return;
          }
          toEpoch = Math.floor(d.getTime() / 1000);
        }
        if (
          fromEpoch !== null &&
          toEpoch !== null &&
          fromEpoch > toEpoch
        ) {
          warn.textContent = "開始日は終了日より前にしてください";
          return;
        }
      }
      cleanup();
      resolve({ range: { fromEpoch, toEpoch } });
    });

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    setTimeout(() => okBtn.focus(), 0);
  });
}
