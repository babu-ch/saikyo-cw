import type { PluginConfig } from "../content/plugins/types";

export const PLUGIN_CONFIGS: PluginConfig[] = [
  {
    id: "input-tools",
    name: "Input Tools",
    description: "コードブロック・絵文字・装飾タグの挿入、TO全選択",
  },
  {
    id: "mute-button",
    name: "Mute Button",
    description: "ワンクリックで通知をミュート",
  },
  {
    id: "quick-task",
    name: "Quick Task",
    description: "メッセージにmy taskボタンを追加",
  },
  {
    id: "mention-group",
    name: "Mention Group",
    description: "グループメンションをワンクリックで挿入",
  },
  {
    id: "reaction-copy",
    name: "Reaction Copy",
    description: "リアクションしたユーザー一覧をワンクリックでコピー",
  },
  {
    id: "mention-autocomplete",
    name: "Mention Autocomplete",
    description: "@を入力するとメンバー候補を表示してメンション挿入",
  },
  {
    id: "vip-notify",
    name: "VIP Notify",
    description:
      "VIPメンバーの未読発言があるルームのバッジ色を変更。表示中のチャット一覧のみ検知（最大80件）。APIトークンを消費します（通常5分で10〜50リクエスト、最大80リクエスト/回）。",
    defaultEnabled: false,
  },
];
