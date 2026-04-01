import { describe, it, expect, vi } from "vitest";
import {
  setReactInputValue,
  appendToReactInput,
  insertAtCursor,
  wrapSelection,
} from "../shared/react-input";

function createTextarea(value = ""): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.value = value;
  document.body.appendChild(ta);
  return ta;
}

describe("react-input", () => {
  describe("setReactInputValue", () => {
    it("textareaのvalueを設定できる", () => {
      const ta = createTextarea();
      setReactInputValue(ta, "hello");
      expect(ta.value).toBe("hello");
    });

    it("inputイベントを発火する", () => {
      const ta = createTextarea();
      const handler = vi.fn();
      ta.addEventListener("input", handler);

      setReactInputValue(ta, "test");

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("appendToReactInput", () => {
    it("既存テキストの後ろに追記する", () => {
      const ta = createTextarea("hello");
      appendToReactInput(ta, " world");
      expect(ta.value).toBe("hello world");
    });
  });

  describe("insertAtCursor", () => {
    it("カーソル位置にテキストを挿入する", () => {
      const ta = createTextarea("helloworld");
      ta.selectionStart = 5;
      ta.selectionEnd = 5;

      insertAtCursor(ta, " ");

      expect(ta.value).toBe("hello world");
    });

    it("選択範囲を置換する", () => {
      const ta = createTextarea("hello world");
      ta.selectionStart = 6;
      ta.selectionEnd = 11;

      insertAtCursor(ta, "vitest");

      expect(ta.value).toBe("hello vitest");
    });

    it("カーソルが挿入テキストの後ろに移動する", () => {
      const ta = createTextarea("ab");
      ta.selectionStart = 1;
      ta.selectionEnd = 1;

      insertAtCursor(ta, "XY");

      expect(ta.selectionStart).toBe(3);
      expect(ta.selectionEnd).toBe(3);
    });
  });

  describe("wrapSelection", () => {
    it("選択テキストをタグで囲む", () => {
      const ta = createTextarea("hello code here end");
      ta.selectionStart = 6;
      ta.selectionEnd = 15;

      wrapSelection(ta, "[code]", "[/code]");

      expect(ta.value).toBe("hello [code]code here[/code] end");
    });

    it("選択なしの場合、カーソル位置に空タグを挿入する", () => {
      const ta = createTextarea("hello");
      ta.selectionStart = 5;
      ta.selectionEnd = 5;

      wrapSelection(ta, "[code]", "[/code]");

      expect(ta.value).toBe("hello[code][/code]");
    });

    it("カーソルが閉じタグの前に移動する", () => {
      const ta = createTextarea("test");
      ta.selectionStart = 0;
      ta.selectionEnd = 4;

      wrapSelection(ta, "[b]", "[/b]");

      expect(ta.value).toBe("[b]test[/b]");
      expect(ta.selectionStart).toBe(7); // [b] + test の末尾
    });
  });
});
