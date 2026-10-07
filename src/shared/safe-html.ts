import { escapeHtml } from "./escape-html";

/**
 * html`` テンプレートで組み立てたエスケープ済みHTML断片。
 * innerHTML に流し込んでよいのはこの型だけ（setHtml 経由）。
 */
export class SafeHtml {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  toString(): string {
    return this.#value;
  }
}

export type HtmlValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SafeHtml
  | readonly HtmlValue[];

function serialize(v: HtmlValue): string {
  // null/undefined/boolean は何も出さない（`${cond && html`...`}` の形を許す）
  if (v === null || v === undefined || typeof v === "boolean") return "";
  if (v instanceof SafeHtml) return v.toString();
  if (Array.isArray(v)) return (v as readonly HtmlValue[]).map(serialize).join("");
  return escapeHtml(String(v));
}

/**
 * タグ付きテンプレート。`${}` に入れた値は文字列・数値なら必ずエスケープされる。
 * 入れ子にしたい場合は html`` の結果（SafeHtml）か、その配列を渡す。
 */
export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    out += serialize(values[i]) + (strings[i + 1] ?? "");
  }
  return new SafeHtml(out);
}

/**
 * 要素の中身を SafeHtml で置き換える。
 * innerHTML に触ってよいのはこの関数だけ（ESLintで他の箇所は禁止している）。
 */
export function setHtml(el: Element, content: SafeHtml): void {
  // eslint-disable-next-line no-restricted-syntax -- html`` でエスケープ済みの値しか受け取らない
  el.innerHTML = content.toString();
}
