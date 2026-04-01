/**
 * ChatworkはReact製のため、textareaのvalueを直接書き換えても
 * Reactが変更を検知しない。native setterと_valueTrackerを使って対応する。
 */
export function setReactInputValue(
  input: HTMLTextAreaElement | HTMLInputElement,
  value: string,
): void {
  const prototype =
    input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(
    prototype,
    "value",
  )?.set;
  if (!nativeSetter) throw new Error("Cannot find native value setter");

  nativeSetter.call(input, value);

  // Reactの内部trackerをリセットして変更を検知させる
  const tracker = (input as unknown as { _valueTracker?: { setValue(v: string): void } })
    ._valueTracker;
  if (tracker) {
    tracker.setValue("");
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * 現在のテキストエリアの値に追記する
 */
export function appendToReactInput(
  input: HTMLTextAreaElement | HTMLInputElement,
  text: string,
): void {
  const current = input.value;
  setReactInputValue(input, current + text);
}

/**
 * カーソル位置にテキストを挿入する
 */
export function insertAtCursor(
  input: HTMLTextAreaElement | HTMLInputElement,
  text: string,
): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.substring(0, start);
  const after = input.value.substring(end);
  setReactInputValue(input, before + text + after);

  // カーソルを挿入テキストの後ろに移動
  const newPos = start + text.length;
  input.setSelectionRange(newPos, newPos);
}

/**
 * 選択テキストをタグで囲む
 */
export function wrapSelection(
  input: HTMLTextAreaElement | HTMLInputElement,
  before: string,
  after: string,
): void {
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const textBefore = input.value.substring(0, start);
  const selected = input.value.substring(start, end);
  const textAfter = input.value.substring(end);
  setReactInputValue(input, textBefore + before + selected + after + textAfter);

  // 選択テキストの後ろ（閉じタグの前）にカーソルを置く
  const newPos = start + before.length + selected.length;
  input.setSelectionRange(newPos, newPos);
}
