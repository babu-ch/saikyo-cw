import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// HTMLインジェクションの入口になるAPIを禁止する。
// HTML文字列を組み立てるときは src/shared/safe-html.ts の html`` + setHtml() を使う。
const HTML_SINK_RULES = [
  {
    selector:
      "MemberExpression[property.name='innerHTML'], MemberExpression[computed=true][property.value='innerHTML']",
    message:
      "innerHTML は禁止。src/shared/safe-html.ts の html`` で組み立てて setHtml(el, ...) で流し込む（${}は自動エスケープ）。文字列だけなら textContent、空にするなら replaceChildren() を使う",
  },
  {
    selector:
      "AssignmentExpression > MemberExpression.left[property.name='outerHTML'], AssignmentExpression > MemberExpression.left[computed=true][property.value='outerHTML']",
    message: "outerHTML への代入は禁止。html`` + setHtml() か DOM API を使う",
  },
  {
    selector:
      "CallExpression > MemberExpression.callee[property.name='insertAdjacentHTML']",
    message: "insertAdjacentHTML は禁止。html`` + setHtml() か insertAdjacentElement を使う",
  },
  {
    selector:
      "CallExpression > MemberExpression.callee[object.name='document'][property.name=/^(write|writeln)$/]",
    message: "document.write は禁止",
  },
];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, chrome: "readonly", __DEV__: "readonly" },
    },
    rules: {
      "no-restricted-syntax": ["error", ...HTML_SINK_RULES],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // UI文言のテンプレート内で全角スペースを使うことがある
      "no-irregular-whitespace": ["error", { skipTemplates: true }],
    },
  },
  {
    // テストのDOMフィクスチャ構築は固定文字列なので許可
    files: ["src/__tests__/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["vite.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
);
