import { describe, it, expect, afterEach } from "vitest";
import { waitFor, waitForElement } from "../shared/dom-helpers";

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

  describe("waitFor", () => {
    it("後から見つかった値を返す", async () => {
      const promise = waitFor(() => document.querySelector("#later"));
      setTimeout(() => {
        const el = document.createElement("div");
        el.id = "later";
        document.body.appendChild(el);
      }, 10);
      expect((await promise)?.id).toBe("later");
    });

    it("見つからないままタイムアウトしたらnull", async () => {
      expect(await waitFor(() => document.querySelector("#never"), 20)).toBeNull();
    });
  });
});
