import { useState } from "react";
import { Download, FileArchive, FileText, ImageIcon, Loader2, Paperclip, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { zipSync } from "fflate";
import { toast } from "sonner";

export type SupportAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string | null;
  scan_status?: string;
  scan_result?: string | null;
};

const SCAN_LABELS: Record<string, { text: string; className: string; Icon: typeof ShieldCheck }> = {
  clean: { text: "Virus scan passed", className: "text-emerald-600", Icon: ShieldCheck },
  pending: { text: "Scanning for viruses…", className: "text-amber-600", Icon: ShieldQuestion },
  scanning: { text: "Scanning for viruses…", className: "text-amber-600", Icon: ShieldQuestion },
  infected: { text: "Blocked — malware detected", className: "text-red-600", Icon: ShieldAlert },
  error: { text: "Blocked — scan failed", className: "text-red-600", Icon: ShieldAlert },
};

export function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
  rows,
  loading,
  title = "Attachments",
  allowBulkDownload = false,
  zipName = "attachments",
}: {
  rows: SupportAttachment[];
  loading?: boolean;
  title?: string;
  allowBulkDownload?: boolean;
  zipName?: string;
}) {
  const [zipping, setZipping] = useState(false);

  if (loading) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading attachments…
      </p>
    );
  }
  if (rows.length === 0) return null;

  const downloadable = rows.filter((r) => (r.scan_status ?? "clean") === "clean" && r.url);

  // Only virus-scanned ("clean") files are ever fetched into the archive.
  const downloadAll = async () => {
    setZipping(true);
    try {
      const files: Record<string, Uint8Array> = {};
      const used = new Set<string>();
      for (const a of downloadable) {
        const res = await fetch(a.url!);
        if (!res.ok) throw new Error(`Failed to fetch ${a.file_name}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        let name = a.file_name.replace(/[/\\]/g, "_") || "file";
        let i = 1;
        while (used.has(name)) {
          const dot = name.lastIndexOf(".");
          const base = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          name = `${base} (${i++})${ext}`;
        }
        used.add(name);
        files[name] = bytes;
      }
      const zipped = zipSync(files, { level: 6 });
      const blob = new Blob([zipped as unknown as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${zipName}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Download failed", { description: e instanceof Error ? e.message : "Please try again." });
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="mt-4" data-testid="support-attachments">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <Paperclip className="h-3.5 w-3.5" /> {title} ({rows.length})
        </h3>
        {allowBulkDownload && downloadable.length > 1 && (
          <button
            type="button"
            data-testid="support-attachments-download-all"
            onClick={() => void downloadAll()}
            disabled={zipping}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileArchive className="h-3.5 w-3.5" />}
            {zipping ? "Preparing…" : `Download all (${downloadable.length})`}
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-2">
        {rows.map((a) => {
          const status = a.scan_status ?? "clean";
          const scan = SCAN_LABELS[status] ?? SCAN_LABELS["pending"]!;
          const blocked = status !== "clean";
          const isImage = a.mime_type.startsWith("image/") && !blocked;
          return (
            <li
              key={a.id}
              data-testid="support-attachment-item"
              className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3"
            >
              {isImage && a.url ? (
                <img
                  src={a.url}
                  alt={a.file_name}
                  loading="lazy"
                  className="h-12 w-12 flex-none rounded-xl object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                  {isImage ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{a.file_name}</p>
                <p className="text-[11px] text-neutral-500">
                  {formatBytes(a.size_bytes)} · {new Date(a.created_at).toLocaleString()}
                </p>
                <p
                  data-testid="support-attachment-scan"
                  data-scan-status={status}
                  className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${scan.className}`}
                  title={a.scan_result ?? undefined}
                >
                  <scan.Icon className="h-3 w-3" /> {scan.text}
                </p>
              </div>
              {blocked ? (
                <span className="text-[11px] font-medium text-neutral-400">
                  {status === "infected" || status === "error" ? "Unavailable" : "Pending scan"}
                </span>
              ) : a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={a.file_name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <Download className="h-3.5 w-3.5" /> View
                </a>
              ) : (
                <span className="text-[11px] text-neutral-400">Unavailable</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
