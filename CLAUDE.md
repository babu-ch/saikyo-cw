# CLAUDE.md

## プロジェクト概要

Chatwork拡張Chrome拡張機能。プラグインアーキテクチャで機能をOn/Off可能。
Manifest V3、TypeScript、Viteでビルド。

## コマンド

```bash
npm run build      # ビルド（content→background→optionsの3段階）
npm run package    # ビルド + dist/をzip化（saikyo-cw.zip）
npm test           # vitest実行
npm run typecheck  # tsc --noEmit
```

## ビルド構成

content/backgroundはIIFE形式、optionsはHTML entryで別々にビルドする（`BUILD_TARGET`環境変数で切り替え）。
Chrome拡張のcontent scriptはESM importが使えないため。

## プラグインの追加方法

1. `src/content/plugins/<plugin-name>/index.ts` — `CwPlugin`インターフェース（init/destroy）を実装
2. `src/shared/plugin-configs.ts` — PLUGIN_CONFIGSにメタ情報追加
3. `src/content/plugin-runner.ts` — importとALL_PLUGINSに追加
4. オプション画面のトグルUIは自動描画される。詳細設定がある場合は`src/options/index.ts`に`appendCollapsible`で追加

## 重要なパターン

- **React対応**: ChatworkはReact製なのでtextarea.valueを直接書き換えてもReactが検知しない。`src/shared/react-input.ts`の`setReactInputValue`を必ず使う
- **DOMセレクタ**: `src/shared/chatwork-selectors.ts`に一元管理。CWのDOM構造変更時はここだけ修正
- **ストレージ**: `chrome.storage.sync`を使用。プラグイン設定は`plugin_`プレフィックス付き。共通APIトークンは`chatworkApiToken`キー
- **API呼び出し**: content scriptからChatwork APIを叩く場合、CORSのためbackground script経由で`chrome.runtime.sendMessage`を使う

## セキュリティルール

- **innerHTML**: 値を埋め込む場合は必ず`escapeHtml()`を通す。`textContent`で済む場合はそちらを使う
- **メッセージハンドラ**: `chrome.runtime.onMessage`のリスナーでは`sender.url`が自拡張またはchatwork.comであることを検証する
- **URL補間**: ユーザー入力やメッセージ経由の値をURL文字列に埋め込む前に形式をバリデーションする（例: roomIdは`/^\d+$/`）
- **ログ**: ユーザー名・アカウントIDなどの個人情報をログに含めない
- **CSP**: `manifest.json`の`content_security_policy`（`script-src 'self'; object-src 'none'`）を維持する

## UI方針

- CWに注入するボタンは既存UIのトンマナに合わせる。独自スタイルを当てずに既存ボタンのclassをコピーする
- プロフィールカードのボタンは既存ボタンのDOM構造（wrapper→inner→button）をcloneNodeして追加する
- オプション画面の詳細設定はcollapse（折りたたみ）式にする

## ドキュメント

- プラグイン追加・削除時は`README.md`の機能一覧も更新する

## バージョン管理

- `package.json`と`public/manifest.json`の両方のversionを更新する
- 機能追加PR作成時にバージョンも一緒に上げる（マージ後すぐ`npm run package`でzip作成できるように）

## ブランチ運用

- mainに直接コミットしない。必ずfeatureブランチを切る
- コミット後は`npm run build`も実行する
