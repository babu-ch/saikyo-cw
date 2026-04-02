# ぼくたちがかんがえた最強のチャトワ

Chatworkの拡張機能をまとめた All-in-one Chrome Extension。各機能はプラグインとして実装されており、ポップアップから個別にOn/Offできます。

## 機能

| プラグイン | 説明 |
|-----------|------|
| **Input Tools** | コードブロック・絵文字・装飾タグの挿入ツールバー。ボタンはオプションで選択可能 |
| **Mute Button** | ワンクリックでチャットをミュート（Chatwork標準のミュート機能を自動操作） |
| **Quick Task** | メッセージのアクションメニューに「my」ボタンを追加。4モード対応（マイチャット/現チャット × URL/メッセージ） |
| **Mention Group** | メンバーグループを登録して、ワンクリックでグループ全員へのメンションを挿入。プロフィールカードからグループに追加も可能 |
| **Reaction Copy** | リアクションしたユーザー一覧をコピー。TO付きコピーにも対応 |

## インストール

### Chrome Web Store
[Chrome Web Store](https://chromewebstore.google.com/) からインストール（公開後リンク更新予定）

### 開発版
1. `npm install && npm run build`
2. Chrome で `chrome://extensions` を開く
3. 「デベロッパーモード」をON
4. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダを選択

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
