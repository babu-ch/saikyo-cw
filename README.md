# ぼくたちがかんがえた最強のチャトワ

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/dpmmdeaajgdljjahkjgnfeipijbpcemh)](https://chromewebstore.google.com/detail/dpmmdeaajgdljjahkjgnfeipijbpcemh)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Chatworkの便利機能をまとめた All-in-one Chrome 拡張機能。各機能はプラグインとして実装されており、設定画面から個別にOn/Offできます。

## 機能

| プラグイン | 説明 |
|-----------|------|
| **入力ツール** | コードブロック・絵文字・装飾タグの挿入ツールバー。表示するボタンはオプションで選択可能 |
| **ミュートボタン** | ワンクリックでチャットをミュート |
| **クイックタスク** | メッセージのアクションメニューに「my」ボタンを追加。マイチャット/現チャット × URL/メッセージの4モード対応 |
| **メンショングループ** | メンバーグループを登録して、ワンクリックでグループ全員へのメンションを挿入。プロフィールカードからグループへの追加も可能 |
| **リアクションコピー** | リアクションしたユーザー一覧をコピー。TO付きコピーにも対応 |
| **メンション補完** | `@` を入力するとメンバー候補を表示してメンション挿入 |
| **送信ボタン強制** | Enterキーでの送信を無効化し、送信ボタンのクリックでのみ送信可能に（デフォルトOFF） |
| **VIP通知** | VIPメンバーの未読発言があるルームのバッジ色を変更。自動既読機能付き（デフォルトOFF） |

## インストール

[Chrome Web Store](https://chromewebstore.google.com/detail/dpmmdeaajgdljjahkjgnfeipijbpcemh) からインストールできます。

### 開発版

```bash
npm install && npm run build
```

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダを選択

## 設定

拡張アイコンをクリックするとポップアップが開き、各プラグインのOn/Offや詳細設定ができます。

## 開発

```bash
npm install
npm run build    # プロダクションビルド
npm run test     # テスト実行
npm run typecheck # 型チェック
```

## プラグインの追加方法

1. `src/content/plugins/<plugin-name>/index.ts` を作成し、`CwPlugin` インターフェースを実装
2. `src/shared/plugin-configs.ts` にプラグインメタ情報を追加
3. `src/content/plugin-runner.ts` に import を追加

オプションページのトグルUIは自動で描画されます。

## ライセンス

MIT
