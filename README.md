# saikyo-cw

Chatworkの拡張機能をまとめた All-in-one Chrome Extension。各機能はプラグインとして実装されており、オプションページから個別にOn/Offできます。

## 機能

| プラグイン | 説明 |
|-----------|------|
| **Input Tools** | コードブロック `[code]`、絵文字、装飾タグの挿入ツールバー。TO全選択ボタン |
| **Mute Button** | ワンクリックで通知音・デスクトップ通知をミュート |
| **Quick Task** | メッセージのアクションメニューに「My Task」ボタンを追加。クリックでマイチャットにタスクとして登録 |
| **Mention Group** | メンバーグループを登録して、ワンクリックでグループ全員へのメンションを挿入 |

## 開発

```bash
# 依存インストール
npm install

# 開発ビルド (watch)
npm run dev

# プロダクションビルド
npm run build

# 型チェック
npm run typecheck
```

## Chrome拡張として読み込む

1. `npm run build` を実行
2. Chrome で `chrome://extensions` を開く
3. 「デベロッパーモード」をON
4. 「パッケージ化されていない拡張機能を読み込む」→ `dist/` フォルダを選択

## プラグインの追加方法

新しいプラグインを追加するには:

1. `src/content/plugins/<plugin-name>/index.ts` を作成し、`CwPlugin` インターフェースを実装
2. `src/shared/plugin-configs.ts` にプラグインメタ情報を追加
3. `src/content/plugin-runner.ts` に import を追加

オプションページのトグルUIは自動で描画されます。

## ライセンス

MIT
