/**
 * RFC 4180準拠のCSV生成ヘルパー。
 * - カンマ・ダブルクォート・改行を含むフィールドはダブルクォートで囲み、内部の " は "" にエスケープ
 * - 行区切りは CRLF
 * - 先頭にBOMを付けてExcelでUTF-8として開けるようにする
 */

export type CsvRow = ReadonlyArray<string | number | boolean | null | undefined>;

function escapeField(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const BOM = "﻿";

export function rowsToCsv(rows: ReadonlyArray<CsvRow>, options: { bom?: boolean } = {}): string {
  const { bom = true } = options;
  const body = rows.map((r) => r.map(escapeField).join(",")).join("\r\n");
  return (bom ? BOM : "") + body;
}

export function downloadCsv(filename: string, rows: ReadonlyArray<CsvRow>): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
