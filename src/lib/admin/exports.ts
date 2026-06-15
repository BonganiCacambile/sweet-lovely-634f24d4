import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn<T> = { key: keyof T | string; label: string; map?: (row: T) => unknown };

function toRows<T>(rows: T[], cols: ExportColumn<T>[]) {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of cols) {
      out[c.label] = c.map ? c.map(r) : (r as Record<string, unknown>)[c.key as string];
    }
    return out;
  });
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv<T>(rows: T[], cols: ExportColumn<T>[], filename: string) {
  const data = toRows(rows, cols);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportXlsx<T>(rows: T[], cols: ExportColumn<T>[], filename: string) {
  const data = toRows(rows, cols);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function exportPdf<T>(rows: T[], cols: ExportColumn<T>[], filename: string, title?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  if (title) { doc.setFontSize(14); doc.text(title, 14, 14); }
  const head = [cols.map((c) => c.label)];
  const body = rows.map((r) => cols.map((c) => String((c.map ? c.map(r) : (r as Record<string, unknown>)[c.key as string]) ?? "")));
  autoTable(doc, { head, body, startY: title ? 20 : 14, styles: { fontSize: 9 } });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}