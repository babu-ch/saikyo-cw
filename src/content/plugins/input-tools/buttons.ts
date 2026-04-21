import { wrapSelection, insertAtCursor } from "../../../shared/react-input";

export interface ToolButtonDef {
  id: string;
  label: string;
  ariaLabel: string;
  type: "tag" | "emo" | "action";
  action: (textarea: HTMLTextAreaElement) => void;
}

function selectAllTo(): void {
  const toBtn = document.querySelector("#_to") as HTMLElement | null;
  if (toBtn) {
    toBtn.click();
    setTimeout(() => {
      const checkboxes = document.querySelectorAll<HTMLInputElement>(
        '#_toList input[type="checkbox"]:not(:checked)',
      );
      checkboxes.forEach((cb) => cb.click());
    }, 200);
  }
}

// id → action のマッピング
const ACTIONS: Record<string, (ta: HTMLTextAreaElement) => void> = {
  info: (ta) => wrapSelection(ta, "[info]", "[/info]"),
  title: (ta) => wrapSelection(ta, "[info][title]", "[/title][/info]"),
  code: (ta) => wrapSelection(ta, "[code]", "[/code]"),
  hr: (ta) => insertAtCursor(ta, "[hr]"),
  bow: (ta) => insertAtCursor(ta, "(bow)"),
  roger: (ta) => insertAtCursor(ta, "(roger)"),
  cracker: (ta) => insertAtCursor(ta, "(cracker)"),
  clap: (ta) => insertAtCursor(ta, "(clap)"),
  congrats: (ta) => insertAtCursor(ta, "(congrats)"),
  love: (ta) => insertAtCursor(ta, "(love)"),
  smile: (ta) => insertAtCursor(ta, ":)"),
  sad: (ta) => insertAtCursor(ta, ":("),
  "more-smile": (ta) => insertAtCursor(ta, ":D"),
  lucky: (ta) => insertAtCursor(ta, "8-)"),
  surprise: (ta) => insertAtCursor(ta, ":o"),
  wink: (ta) => insertAtCursor(ta, ";)"),
  tears: (ta) => insertAtCursor(ta, ";("),
  sweat: (ta) => insertAtCursor(ta, "(sweat)"),
  mumu: (ta) => insertAtCursor(ta, ":|"),
  kiss: (ta) => insertAtCursor(ta, ":*"),
  tongueout: (ta) => insertAtCursor(ta, ":p"),
  blush: (ta) => insertAtCursor(ta, "(blush)"),
  wonder: (ta) => insertAtCursor(ta, ":^)"),
  snooze: (ta) => insertAtCursor(ta, "|-)"),
  inlove: (ta) => insertAtCursor(ta, "(inlove)"),
  grin: (ta) => insertAtCursor(ta, "]:)"),
  talk: (ta) => insertAtCursor(ta, "(talk)"),
  yawn: (ta) => insertAtCursor(ta, "(yawn)"),
  puke: (ta) => insertAtCursor(ta, "(puke)"),
  ikemen: (ta) => insertAtCursor(ta, "(emo)"),
  otaku: (ta) => insertAtCursor(ta, "8-|"),
  ninmari: (ta) => insertAtCursor(ta, ":#)"),
  nod: (ta) => insertAtCursor(ta, "(nod)"),
  shake: (ta) => insertAtCursor(ta, "(shake)"),
  "wry-smile": (ta) => insertAtCursor(ta, "(^^;)"),
  whew: (ta) => insertAtCursor(ta, "(whew)"),
  flex: (ta) => insertAtCursor(ta, "(flex)"),
  dance: (ta) => insertAtCursor(ta, "(dance)"),
  komanechi: (ta) => insertAtCursor(ta, "(:/)"),
  gogo: (ta) => insertAtCursor(ta, "(gogo)"),
  think: (ta) => insertAtCursor(ta, "(think)"),
  please: (ta) => insertAtCursor(ta, "(please)"),
  quick: (ta) => insertAtCursor(ta, "(quick)"),
  anger: (ta) => insertAtCursor(ta, "(anger)"),
  devil: (ta) => insertAtCursor(ta, "(devil)"),
  lightbulb: (ta) => insertAtCursor(ta, "(lightbulb)"),
  star: (ta) => insertAtCursor(ta, "(*)"),
  heart: (ta) => insertAtCursor(ta, "(h)"),
  flower: (ta) => insertAtCursor(ta, "(F)"),
  eat: (ta) => insertAtCursor(ta, "(eat)"),
  cake: (ta) => insertAtCursor(ta, "(^)"),
  coffee: (ta) => insertAtCursor(ta, "(coffee)"),
  beer: (ta) => insertAtCursor(ta, "(beer)"),
  handshake: (ta) => insertAtCursor(ta, "(handshake)"),
  yes: (ta) => insertAtCursor(ta, "(y)"),
  "to-all": () => selectAllTo(),
};

export function getAction(id: string): ((ta: HTMLTextAreaElement) => void) | undefined {
  return ACTIONS[id];
}
