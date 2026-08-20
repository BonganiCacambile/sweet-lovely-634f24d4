import { Download, FileText, ImageIcon, Loader2, Paperclip } from "lucide-react";

export type SupportAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  url: string | null;
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
}: {
  rows: SupportAttachment[];
  loading?: boolean;
  title?: string;
}) {
  if (loading) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading attachments…
      </p>
    );
  }
  if (rows.length === 0) return null;

  return (
    <div className="mt-4" data-testid="support-attachments">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
        <Paperclip className="h-3.5 w-3.5" /> {title} ({rows.length})
      </h3>
      <ul className="mt-2 space-y-2">
        {rows.map((a) => {
          const isImage = a.mime_type.startsWith("image/");
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
              </div>
              {a.url ? (
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
