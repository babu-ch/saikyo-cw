/** ボタンのメタデータ（content scriptとoptions両方から参照） */
export interface ToolButtonMeta {
  id: string;
  label: string;
  description: string;
  type: "tag" | "emo" | "action";
  defaultEnabled: boolean;
}

export const ALL_BUTTON_METAS: ToolButtonMeta[] = [
  { id: "info", label: "info", description: "infoタグで囲む", type: "tag", defaultEnabled: true },
  { id: "title", label: "title", description: "titleタグで囲む", type: "tag", defaultEnabled: true },
  { id: "code", label: "code", description: "codeタグで囲む", type: "tag", defaultEnabled: true },
  { id: "hr", label: "hr", description: "hrタグを挿入", type: "tag", defaultEnabled: true },
  { id: "bow", label: "🙇", description: "おじぎ (bow)", type: "emo", defaultEnabled: true },
  { id: "roger", label: "👌", description: "了解 (roger)", type: "emo", defaultEnabled: true },
  { id: "cracker", label: "🎉", description: "クラッカー (cracker)", type: "emo", defaultEnabled: true },
  { id: "clap", label: "👏", description: "拍手 (clap)", type: "emo", defaultEnabled: false },
  { id: "congrats", label: "㊗️", description: "おめでとう (congrats)", type: "emo", defaultEnabled: false },
  { id: "love", label: "❤️", description: "ハート (love)", type: "emo", defaultEnabled: false },
  { id: "to-all", label: "@all", description: "全員にTO", type: "action", defaultEnabled: true },
];

export function getDefaultEnabledIds(): string[] {
  return ALL_BUTTON_METAS.filter((b) => b.defaultEnabled).map((b) => b.id);
}
