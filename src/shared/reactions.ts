export interface QuickReaction {
  /** aria-label (Chatworkのリアクションボタンとの突き合わせキー) */
  label: string;
  /** assets.chatwork.com/images/emoticon2x/ 以下のファイル名 */
  emoticon: string;
  /** img alt (ツールチップ的な補足) */
  describe: string;
}

export const ALL_REACTIONS: QuickReaction[] = [
  { label: "了解",       emoticon: "emo_roger.gif",   describe: "了解する人" },
  { label: "ありがとう", emoticon: "emo_bow.gif",     describe: "おじぎする人" },
  { label: "おめでとう", emoticon: "emo_cracker.gif", describe: "クラッカー" },
  { label: "わーい",     emoticon: "emo_dance.gif",   describe: "踊る人" },
  { label: "すごい",     emoticon: "emo_clap.gif",    describe: "拍手する人" },
  { label: "いいね",     emoticon: "emo_yes.gif",     describe: "親指を上げた手" },
];
