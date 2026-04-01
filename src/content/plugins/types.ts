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
}

export interface CwPlugin {
  config: PluginConfig;
  /** プラグイン有効化時に呼ばれる */
  init(): void;
  /** プラグイン無効化時にクリーンアップ */
  destroy(): void;
}
