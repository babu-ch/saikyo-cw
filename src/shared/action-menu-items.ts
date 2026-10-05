/**
 * メッセージのアクションメニューに並ぶ項目のメタデータ（content scriptとoptions両方から参照）。
 * 並び順はCWのメニューの表示順に合わせる。
 */
export interface NativeActionMenuItem {
  type: "native";
  id: string;
  label: string;
  description: string;
  /** 文言変更に備えてラベルではなくアイコン（`<use href="#...">`）で見分ける */
  icon: string;
}

export interface PluginActionMenuItem {
  type: "plugin";
  /** ボタンを追加するプラグインのID。表示/非表示はそのプラグインのOn/Offで切り替える */
  id: string;
  label: string;
  description: string;
}

/** 「その他（…）」の中にある項目。メニューに出すと「その他」の手前にボタンを置く */
export interface MoreActionMenuItem {
  type: "more";
  id: string;
  label: string;
  description: string;
  icon: string;
  /** 自分の発言（「編集」がある）の「その他」にだけある */
  ownOnly?: boolean;
}

export type ActionMenuItem = NativeActionMenuItem | PluginActionMenuItem | MoreActionMenuItem;

export const ACTION_MENU_ITEMS: ActionMenuItem[] = [
  { type: "native", id: "reply", label: "返信", description: "他の人の発言に出る", icon: "icon_reply" },
  { type: "native", id: "edit", label: "編集", description: "自分の発言に出る", icon: "icon_edit" },
  { type: "native", id: "reaction", label: "リアクション", description: "リアクションの一覧を開く", icon: "icon_reaction" },
  { type: "native", id: "quote", label: "引用", description: "入力欄に引用を挿入", icon: "icon_quote" },
  { type: "native", id: "bookmark", label: "ブックマーク", description: "メッセージをブックマーク", icon: "icon_bookmark" },
  { type: "native", id: "task", label: "タスク", description: "タスク追加の画面を開く", icon: "icon_task" },
  { type: "plugin", id: "quick-task", label: "my", description: "ワンクリックで自分のタスクにする" },
  { type: "native", id: "link", label: "リンク", description: "入力欄にリンクを挿入", icon: "icon_link" },
  { type: "plugin", id: "link-copy", label: "リンクをコピー", description: "リンクをクリップボードにコピー" },
  { type: "native", id: "ai-draft", label: "AI下書き", description: "他の人の発言に出る", icon: "icon_aiDraft" },
  { type: "more", id: "copy", label: "コピー", description: "メッセージの本文をコピー", icon: "icon_copy" },
  { type: "more", id: "unread", label: "未読", description: "このメッセージから未読にする", icon: "icon_unread" },
  { type: "more", id: "delete", label: "削除", description: "自分の発言だけに出る", icon: "icon_delete", ownOnly: true },
];
