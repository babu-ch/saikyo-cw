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
  "to-all": () => selectAllTo(),
};

export function getAction(id: string): ((ta: HTMLTextAreaElement) => void) | undefined {
  return ACTIONS[id];
}
