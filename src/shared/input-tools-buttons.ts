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
  { id: "smile", label: "🙂", description: "笑っている顔 :)", type: "emo", defaultEnabled: false },
  { id: "sad", label: "🙁", description: "悲しい顔 :(", type: "emo", defaultEnabled: false },
  { id: "more-smile", label: "😁", description: "大笑いの顔 :D", type: "emo", defaultEnabled: false },
  { id: "lucky", label: "😎", description: "サングラスの笑顔 8-)", type: "emo", defaultEnabled: false },
  { id: "surprise", label: "😮", description: "驚いた顔 :o", type: "emo", defaultEnabled: false },
  { id: "wink", label: "😉", description: "ウィンクの顔 ;)", type: "emo", defaultEnabled: false },
  { id: "tears", label: "😢", description: "泣き顔 ;(", type: "emo", defaultEnabled: false },
  { id: "sweat", label: "💦", description: "冷や汗の顔 (sweat)", type: "emo", defaultEnabled: false },
  { id: "mumu", label: "😐", description: "黙っている顔 :|", type: "emo", defaultEnabled: false },
  { id: "kiss", label: "😘", description: "キスの顔 :*", type: "emo", defaultEnabled: false },
  { id: "tongueout", label: "😛", description: "舌を出した顔 :p", type: "emo", defaultEnabled: false },
  { id: "blush", label: "😊", description: "頬を赤らめる顔 (blush)", type: "emo", defaultEnabled: false },
  { id: "wonder", label: "🤨", description: "眉をひそめる顔 :^)", type: "emo", defaultEnabled: false },
  { id: "snooze", label: "😴", description: "寝てる顔 |-)", type: "emo", defaultEnabled: false },
  { id: "inlove", label: "😍", description: "ハートの笑顔 (inlove)", type: "emo", defaultEnabled: false },
  { id: "grin", label: "😏", description: "不敵な笑顔 ]:)", type: "emo", defaultEnabled: false },
  { id: "talk", label: "🗣️", description: "お喋りしてる顔 (talk)", type: "emo", defaultEnabled: false },
  { id: "yawn", label: "🥱", description: "眠い顔 (yawn)", type: "emo", defaultEnabled: false },
  { id: "puke", label: "🤮", description: "嘔吐の顔 (puke)", type: "emo", defaultEnabled: false },
  { id: "ikemen", label: "💁", description: "髪をかきあげる顔 (emo)", type: "emo", defaultEnabled: false },
  { id: "otaku", label: "🤓", description: "メガネをかけている顔 8-|", type: "emo", defaultEnabled: false },
  { id: "ninmari", label: "😼", description: "ニヤニヤした笑顔 :#)", type: "emo", defaultEnabled: false },
  { id: "nod", label: "🙆", description: "頷く顔 (nod)", type: "emo", defaultEnabled: false },
  { id: "shake", label: "🙅", description: "首を横に振る顔 (shake)", type: "emo", defaultEnabled: false },
  { id: "wry-smile", label: "😅", description: "汗をかいた笑顔 (^^;)", type: "emo", defaultEnabled: false },
  { id: "whew", label: "😤", description: "汗を拭う顔 (whew)", type: "emo", defaultEnabled: false },
  { id: "flex", label: "💪", description: "力こぶを作る人 (flex)", type: "emo", defaultEnabled: false },
  { id: "dance", label: "💃", description: "踊る人 (dance)", type: "emo", defaultEnabled: false },
  { id: "komanechi", label: "🤪", description: "ひょうきんな顔 (:/)", type: "emo", defaultEnabled: false },
  { id: "gogo", label: "✊", description: "こぶしを掲げる人 (gogo)", type: "emo", defaultEnabled: false },
  { id: "think", label: "🤔", description: "考えている顔 (think)", type: "emo", defaultEnabled: false },
  { id: "please", label: "🙏", description: "お願いする人 (please)", type: "emo", defaultEnabled: false },
  { id: "quick", label: "🏃", description: "急いでいる人 (quick)", type: "emo", defaultEnabled: false },
  { id: "anger", label: "😡", description: "怒っている顔 (anger)", type: "emo", defaultEnabled: false },
  { id: "devil", label: "😈", description: "笑顔の悪魔 (devil)", type: "emo", defaultEnabled: false },
  { id: "lightbulb", label: "💡", description: "電球 (lightbulb)", type: "emo", defaultEnabled: false },
  { id: "star", label: "⭐", description: "星 (*)", type: "emo", defaultEnabled: false },
  { id: "heart", label: "💗", description: "ふるえるハート (h)", type: "emo", defaultEnabled: false },
  { id: "flower", label: "🌸", description: "開花 (F)", type: "emo", defaultEnabled: false },
  { id: "eat", label: "🍽️", description: "食事 (eat)", type: "emo", defaultEnabled: false },
  { id: "cake", label: "🍰", description: "ケーキ (^)", type: "emo", defaultEnabled: false },
  { id: "coffee", label: "☕", description: "コーヒー (coffee)", type: "emo", defaultEnabled: false },
  { id: "beer", label: "🍺", description: "ビール (beer)", type: "emo", defaultEnabled: false },
  { id: "handshake", label: "🤝", description: "握手する手 (handshake)", type: "emo", defaultEnabled: false },
  { id: "yes", label: "👍", description: "親指を上げた手 (y)", type: "emo", defaultEnabled: false },
  { id: "to-all", label: "@all", description: "全員にTO", type: "action", defaultEnabled: true },
];

export function getDefaultEnabledIds(): string[] {
  return ALL_BUTTON_METAS.filter((b) => b.defaultEnabled).map((b) => b.id);
}
