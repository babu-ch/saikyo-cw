import { describe, it, expect, afterEach } from "vitest";
import { waitForElement } from "../shared/dom-helpers";

describe("dom-helpers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("waitForElement", () => {
    it("既存の要素を即座に返す", async () => {
      document.body.innerHTML = '<div id="existing">hello</div>';
      const el = await waitForElement("#existing");
      expect(el.textContent).toBe("hello");
    });

    it("後から追加された要素を検出する", async () => {
      const promise = waitForElement("#delayed");

      setTimeout(() => {
        const el = document.createElement("div");
        el.id = "delayed";
        el.textContent = "found";
        document.body.appendChild(el);
      }, 10);

      const el = await promise;
      expect(el.textContent).toBe("found");
    });

    it("タイムアウトでrejectする", async () => {
      await expect(
        waitForElement("#never-exists", 50),
      ).rejects.toThrow("Timeout waiting for: #never-exists");
    });
  });
});
