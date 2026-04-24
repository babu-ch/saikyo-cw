import { describe, it, expect } from "vitest";
import { rowsToCsv } from "../shared/csv-generator";

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
