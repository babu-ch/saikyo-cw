export interface Reaction {
  /** assets.chatwork.com/images/emoticon2x/ 以下のファイル名。CWのリアクション一覧との突き合わせキー */
  emoticon: string;
  /** 名前（CWの一覧のimg alt） */
  describe: string;
  /** CWのリアクション小窓の6種だけにある短い名前（ボタンのaria-label） */
  label?: string;
}

export const EMOTICON_BASE = "https://assets.chatwork.com/images/emoticon2x/";

// CWの「すべてのリアクション」一覧と同じ並び
export const ALL_REACTIONS: Reaction[] = [
  { emoticon: "emo_smile.gif", describe: "笑っている顔" },
  { emoticon: "emo_sad.gif", describe: "悲しい顔" },
  { emoticon: "emo_more_smile.gif", describe: "大笑いの顔" },
  { emoticon: "emo_lucky.gif", describe: "サングラスの笑顔" },
  { emoticon: "emo_surprise.gif", describe: "驚いた顔" },
  { emoticon: "emo_wink.gif", describe: "ウィンクの顔" },
  { emoticon: "emo_tears.gif", describe: "泣き顔" },
  { emoticon: "emo_sweat.gif", describe: "冷や汗の顔" },
  { emoticon: "emo_mumu.gif", describe: "黙っている顔" },
  { emoticon: "emo_kiss.gif", describe: "キスの顔" },
  { emoticon: "emo_tongueout.gif", describe: "舌を出した顔" },
  { emoticon: "emo_blush.gif", describe: "頬を赤らめる顔" },
  { emoticon: "emo_wonder.gif", describe: "眉をひそめる顔" },
  { emoticon: "emo_snooze.gif", describe: "寝てる顔" },
  { emoticon: "emo_love.gif", describe: "ハートの笑顔" },
  { emoticon: "emo_grin.gif", describe: "不敵な笑顔" },
  { emoticon: "emo_talk.gif", describe: "お喋りしてる顔" },
  { emoticon: "emo_yawn.gif", describe: "眠い顔" },
  { emoticon: "emo_puke.gif", describe: "嘔吐の顔" },
  { emoticon: "emo_ikemen.gif", describe: "髪をかきあげる顔" },
  { emoticon: "emo_otaku.gif", describe: "メガネをかけている顔" },
  { emoticon: "emo_ninmari.gif", describe: "ニヤニヤした笑顔" },
  { emoticon: "emo_nod.gif", describe: "頷く顔" },
  { emoticon: "emo_shake.gif", describe: "首を横に振る顔" },
  { emoticon: "emo_wry_smile.gif", describe: "汗をかいた笑顔" },
  { emoticon: "emo_whew.gif", describe: "汗を拭う顔" },
  { emoticon: "emo_clap.gif", describe: "拍手する人", label: "すごい" },
  { emoticon: "emo_bow.gif", describe: "おじぎする人", label: "ありがとう" },
  { emoticon: "emo_roger.gif", describe: "了解する人", label: "了解" },
  { emoticon: "emo_muscle.gif", describe: "力こぶを作る人" },
  { emoticon: "emo_dance.gif", describe: "踊る人", label: "わーい" },
  { emoticon: "emo_komanechi.gif", describe: "ひょうきんな顔" },
  { emoticon: "emo_gogo.gif", describe: "こぶしを掲げる人" },
  { emoticon: "emo_think.gif", describe: "考えている顔" },
  { emoticon: "emo_please.gif", describe: "お願いする人" },
  { emoticon: "emo_quick.gif", describe: "急いでいる人" },
  { emoticon: "emo_anger.gif", describe: "怒っている顔" },
  { emoticon: "emo_devil.gif", describe: "笑顔の悪魔" },
  { emoticon: "emo_lightbulb.gif", describe: "電球" },
  { emoticon: "emo_star.gif", describe: "星" },
  { emoticon: "emo_heart.gif", describe: "ふるえるハート" },
  { emoticon: "emo_flower.gif", describe: "開花" },
  { emoticon: "emo_cracker.gif", describe: "クラッカー", label: "おめでとう" },
  { emoticon: "emo_eat.gif", describe: "食事" },
  { emoticon: "emo_cake.gif", describe: "ケーキ" },
  { emoticon: "emo_coffee.gif", describe: "コーヒー" },
  { emoticon: "emo_beer.gif", describe: "ビール" },
  { emoticon: "emo_handshake.gif", describe: "握手する手" },
  { emoticon: "emo_yes.gif", describe: "親指を上げた手", label: "いいね" },
];

// 未設定時に並べるリアクション。CWのリアクション小窓の6種と同じ並び
export const DEFAULT_REACTIONS: string[] = [
  "emo_roger.gif",
  "emo_bow.gif",
  "emo_cracker.gif",
  "emo_dance.gif",
  "emo_clap.gif",
  "emo_yes.gif",
];

/** 設定値から、存在するリアクションだけを設定順に返す（重複は除く） */
export function resolveReactions(emoticons: readonly string[] | undefined): Reaction[] {
  const byEmoticon = new Map(ALL_REACTIONS.map((r) => [r.emoticon, r]));
  const seen = new Set<string>();
  const result: Reaction[] = [];
  for (const emoticon of emoticons ?? DEFAULT_REACTIONS) {
    const reaction = byEmoticon.get(emoticon);
    if (!reaction || seen.has(emoticon)) continue;
    seen.add(emoticon);
    result.push(reaction);
  }
  return result;
}
