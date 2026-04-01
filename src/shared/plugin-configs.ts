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
];
