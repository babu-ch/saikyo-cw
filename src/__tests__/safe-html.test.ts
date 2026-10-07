import { describe, it, expect } from "vitest";
import { html, setHtml, SafeHtml } from "../shared/safe-html";

describe("html``", () => {
  it("文字列はエスケープされる", () => {
    const name = '<img src=x onerror="alert(1)">';
    expect(html`<b>${name}</b>`.toString()).toBe(
      "<b>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</b>",
    );
  });

  it("属性値の引用符もエスケープされる", () => {
    const v = `" onmouseover="alert(1)`;
    expect(html`<a title="${v}">x</a>`.toString()).toBe(
      '<a title="&quot; onmouseover=&quot;alert(1)">x</a>',
    );
  });

  it("数値はそのまま文字列化される", () => {
    expect(html`<i data-id="${12345}"></i>`.toString()).toBe('<i data-id="12345"></i>');
  });

  it("null/undefined/boolean は空になる", () => {
    expect(html`a${null}b${undefined}c${false}d${true}e`.toString()).toBe("abcde");
  });

  it("入れ子の html`` はエスケープされない", () => {
    const inner = html`<span>${"<x>"}</span>`;
    expect(html`<div>${inner}</div>`.toString()).toBe("<div><span>&lt;x&gt;</span></div>");
  });

  it("配列は連結される（要素ごとにエスケープ）", () => {
    const items = ["<a>", "b"].map((s) => html`<li>${s}</li>`);
    expect(html`<ul>${items}</ul>`.toString()).toBe("<ul><li>&lt;a&gt;</li><li>b</li></ul>");
    expect(html`<p>${["<", ">"]}</p>`.toString()).toBe("<p>&lt;&gt;</p>");
  });

  it("結果は SafeHtml", () => {
    expect(html`x`).toBeInstanceOf(SafeHtml);
  });
});

describe("setHtml", () => {
  it("要素の中身を置き換える", () => {
    const el = document.createElement("div");
    setHtml(el, html`<b>${"<i>"}</b>`);
    expect(el.querySelector("b")?.textContent).toBe("<i>");
    expect(el.querySelector("i")).toBeNull();
  });
});
