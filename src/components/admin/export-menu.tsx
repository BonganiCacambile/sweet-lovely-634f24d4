import { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { exportCsv, exportXlsx, exportPdf, type ExportColumn } from "@/lib/admin/exports";
import { logDataExport } from "@/lib/admin/employee-security.functions";

export function ExportMenu<T>({ rows, columns, filename, title, entity }: { rows: T[]; columns: ExportColumn<T>[]; filename: string; title?: string; entity?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logExport = useServerFn(logDataExport);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Every export is recorded server-side (and row-capped for zone admins)
  // before any file is produced.
  const runExport = async (format: "csv" | "xlsx" | "pdf", write: () => void) => {
    setOpen(false);
    try {
      await logExport({
        data: {
          entity: entity ?? filename,
          format,
          rowCount: rows.length,
          fields: columns.map((c) => String((c as { header?: string }).header ?? "")),
        },
      });
    } catch (e) {
      toast.error("Export blocked", { description: e instanceof Error ? e.message : "Not permitted" });
      return;
    }
    write();
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!rows.length}
        className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" /> Export
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
          <MenuItem icon={<FileSpreadsheet className="h-3.5 w-3.5" />} label="CSV" onClick={() => void runExport("csv", () => exportCsv(rows, columns, filename))} />
          <MenuItem icon={<FileType className="h-3.5 w-3.5" />} label="Excel (.xlsx)" onClick={() => void runExport("xlsx", () => exportXlsx(rows, columns, filename))} />
          <MenuItem icon={<FileText className="h-3.5 w-3.5" />} label="PDF" onClick={() => void runExport("pdf", () => exportPdf(rows, columns, filename, title))} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50">
      {icon} {label}
    </button>
  );
}