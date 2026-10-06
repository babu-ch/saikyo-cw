export interface PluginConfig {
  /** プラグイン固有ID (storageキーとしても使用) */
  id: string;
  /** 表示名 */
  name: string;
  /** 説明文 */
  description: string;
  /** APIキーが必要か */
  requiresApiKey?: boolean;
  /** APIキー入力欄のラベル */
  apiKeyLabel?: string;
  /** デフォルトの有効/無効（必須・明示する） */
  defaultEnabled: boolean;
  /** 常に有効。オプション画面にOn/Offトグルを出さない */
  alwaysOn?: boolean;
  /** オプション画面に単独のカードを出さず、指定したプラグインのカードの中でOn/Offする */
  managedBy?: string;
}

export interface CwPlugin {
  config: PluginConfig;
  /** プラグイン有効化時に呼ばれる */
  init(): void;
  /** プラグイン無効化時にクリーンアップ */
  destroy(): void;
}
