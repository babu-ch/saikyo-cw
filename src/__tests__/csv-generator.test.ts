import { describe, it, expect } from "vitest";
import { rowsToCsv, neutralizeFormula } from "../shared/csv-generator";

describe("csv-generator", () => {
  describe("rowsToCsv", () => {
    it("単純な行を生成する", () => {
      const csv = rowsToCsv([["a", "b", "c"]], { bom: false });
      expect(csv).toBe("a,b,c");
    });

    it("複数行はCRLFで区切る", () => {
      const csv = rowsToCsv([["a", "b"], ["c", "d"]], { bom: false });
      expect(csv).toBe("a,b\r\nc,d");
    });

    it("カンマを含む値はダブルクォートで囲む", () => {
      const csv = rowsToCsv([["a,b", "c"]], { bom: false });
      expect(csv).toBe('"a,b",c');
    });

    it("ダブルクォートを含む値は\"\"にエスケープする", () => {
      const csv = rowsToCsv([['she said "hi"', "x"]], { bom: false });
      expect(csv).toBe('"she said ""hi""",x');
    });

    it("改行を含む値はダブルクォートで囲む", () => {
      const csv = rowsToCsv([["line1\nline2", "x"]], { bom: false });
      expect(csv).toBe('"line1\nline2",x');
    });

    it("null/undefinedは空文字になる", () => {
      const csv = rowsToCsv([[null, undefined, "x"]], { bom: false });
      expect(csv).toBe(",,x");
    });

    it("数値・booleanは文字列化される", () => {
      const csv = rowsToCsv([[1, 2.5, true, false]], { bom: false });
      expect(csv).toBe("1,2.5,true,false");
    });

    it("bomオプション(デフォルトtrue)でUTF-8 BOMが先頭に付く", () => {
      const csv = rowsToCsv([["a"]]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv.slice(1)).toBe("a");
    });
  });
});

describe("csv-generator 数式インジェクション対策", () => {
  it("= + - @ タブ CR で始まる文字列には ' を前置する", () => {
    expect(neutralizeFormula("=HYPERLINK(\"http://evil\",\"x\")")).toBe("'=HYPERLINK(\"http://evil\",\"x\")");
    expect(neutralizeFormula("+1")).toBe("'+1");
    expect(neutralizeFormula("-1")).toBe("'-1");
    expect(neutralizeFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeFormula("\t=1")).toBe("'\t=1");
    expect(neutralizeFormula("\r=1")).toBe("'\r=1");
  });

  it("先頭が通常の文字ならそのまま", () => {
    expect(neutralizeFormula("abc=1")).toBe("abc=1");
    expect(neutralizeFormula("")).toBe("");
    expect(neutralizeFormula("テスト太郎")).toBe("テスト太郎");
  });

  it("rowsToCsv は文字列フィールドにのみ適用し、数値はそのまま", () => {
    const csv = rowsToCsv([["=cmd|' /C calc'!A0", -5, "ok"]], { bom: false });
    // 先頭の ' はクォート対象文字ではないので、そのまま出る
    expect(csv).toBe("'=cmd|' /C calc'!A0,-5,ok");
  });
});
