import type { PluginConfig } from "../content/plugins/types";

export const PLUGIN_CONFIGS: PluginConfig[] = [
  {
    id: "input-tools",
    name: "入力ツール",
    description: "コードブロック・絵文字・装飾タグの挿入、TO全選択",
  },
  {
    id: "mute-button",
    name: "ミュートボタン",
    description: "ワンクリックで通知をミュート",
  },
  {
    id: "quick-task",
    name: "クイックタスク",
    description: "メッセージにmy taskボタンを追加",
  },
  {
    id: "mention-group",
    name: "メンショングループ",
    description: "グループメンションをワンクリックで挿入",
  },
  {
    id: "reaction-copy",
    name: "リアクションコピー",
    description: "リアクションしたユーザー一覧をワンクリックでコピー",
  },
  {
    id: "mention-autocomplete",
    name: "メンション補完",
    description: "@を入力するとメンバー候補を表示してメンション挿入",
  },
  {
    id: "force-send-button",
    name: "送信ボタン強制",
    description:
      "Enterキーでの送信を無効化し、送信ボタンのクリックでのみ送信可能にします",
    defaultEnabled: false,
  },
  {
    id: "vip-notify",
    name: "VIP通知",
    description:
      "VIPメンバーの未読発言があるルームのバッジ色を変更。表示中のチャット一覧のみ検知（最大80件）。APIトークンを消費します（通常5分で10〜50リクエスト、最大80リクエスト/回）。",
    defaultEnabled: false,
  },
];
