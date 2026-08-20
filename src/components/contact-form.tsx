import { useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MapPin, Paperclip, Send, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  submitSupportRequest,
  registerSupportAttachments,
  SUPPORT_CATEGORIES,
  SUPPORT_ATTACHMENT_ACCEPT,
  SUPPORT_ATTACHMENT_BUCKET,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_FILES,
} from "@/lib/support.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatBytes } from "@/components/support/attachment-list";
import { useZone } from "@/lib/zone-context";
import { useAuth } from "@/lib/auth-context";


const schema = z.object({
  subject: z.string().trim().min(1, "Please add a subject").max(140),
  category: z.string().trim().min(1),
  orderNumber: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Message can't be empty").max(1000),
});

type FieldKey = "subject" | "category" | "orderNumber" | "phone" | "message";
type FieldErrors = Partial<Record<FieldKey, string>>;

export function ContactForm() {
  const { user } = useAuth();
  const { selected, openPicker } = useZone();
  const [values, setValues] = useState({
    subject: "",
    category: "general",
    orderNumber: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmation, setConfirmation] = useState<{
    reference: string;
    zoneName: string;
    attachments: number;
  } | null>(null);
  const submitRequest = useServerFn(submitSupportRequest);
  const registerAttachments = useServerFn(registerSupportAttachments);

  const update =
    (key: FieldKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (picked.length === 0) return;
    const next = [...files];
    for (const f of picked) {
      if (f.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
        toast.error(`${f.name} is larger than ${formatBytes(SUPPORT_ATTACHMENT_MAX_BYTES)}.`);
        continue;
      }
      if (next.length >= SUPPORT_ATTACHMENT_MAX_FILES) {
        toast.error(`You can attach up to ${SUPPORT_ATTACHMENT_MAX_FILES} files.`);
        break;
      }
      if (!next.some((existing) => existing.name === f.name && existing.size === f.size)) next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  /** Uploads to the private bucket under the caller's own folder, then records the rows. */
  const uploadAttachments = async (requestId: string, userId: string) => {
    if (files.length === 0) return 0;
    setUploading(true);
    const uploaded: Array<{ storagePath: string; fileName: string; mimeType: string; sizeBytes: number }> = [];
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
        const storagePath = `${userId}/${requestId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage
          .from(SUPPORT_ATTACHMENT_BUCKET)
          .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
        if (error) {
          toast.error(`Could not upload ${file.name}.`);
          continue;
        }
        uploaded.push({
          storagePath,
          fileName: file.name.slice(-120),
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        });
      }
      if (uploaded.length > 0) {
        const res = await registerAttachments({ data: { requestId, files: uploaded } });
        if (!res.ok) {
          toast.error(res.error);
          return 0;
        }
        return res.count;
      }
      return 0;
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      toast.error("Please select a delivery zone before submitting a support request.");
      openPicker();
      return;
    }
    const result = schema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as FieldKey;
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      // The delivery zone is resolved server-side from the customer's profile.
      const res = await submitRequest({ data: result.data });
      if (!res.ok) {
        toast.error(res.error);
        if (res.code === "no_zone") openPicker();
        return;
      }
      const attachments = user ? await uploadAttachments(res.id, user.id) : 0;
      setConfirmation({ reference: res.reference, zoneName: res.zoneName, attachments });
      setValues({ subject: "", category: "general", orderNumber: "", phone: "", message: "" });
      setFiles([]);
    } catch {
      toast.error("Could not send your message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };


  const fieldBase =
    "w-full rounded-full border border-neutral-200 bg-neutral-50/80 px-5 py-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15";

  if (confirmation) {
    return (
      <div
        data-testid="support-confirmation"
        className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 text-center"
      >
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h3 className="mt-3 text-lg font-bold text-emerald-900">Support request submitted</h3>
        <p className="mt-2 text-sm text-emerald-800">
          We&apos;ve received your message and sent it to the {confirmation.zoneName} support team.
        </p>
        <p className="mt-3 inline-flex rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-emerald-900">
          Request {confirmation.reference}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/account/support"
            className="rounded-full bg-[#ff003c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e6003a]"
          >
            View my support requests
          </Link>
          <button
            type="button"
            onClick={() => setConfirmation(null)}
            className="rounded-full border border-emerald-300 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-white"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-neutral-50/80 p-6 text-center">
        <p className="text-sm text-neutral-700">Please sign in so we can link your request to your account.</p>
        <Link
          to="/auth"
          className="mt-4 inline-flex rounded-full bg-[#ff003c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e6003a]"
        >
          Sign in to contact support
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="support-form">
      {/* Informational zone indicator — the zone itself is set server-side. */}
      {selected ? (
        <div
          data-testid="support-zone-indicator"
          className="flex flex-wrap items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5 text-sm text-neutral-700"
        >
          <MapPin className="h-4 w-4 text-[#ff003c]" />
          <span>
            Your selected delivery zone: <strong className="font-semibold text-neutral-900">{selected.name}</strong>
          </span>
        </div>
      ) : (
        <div
          data-testid="support-zone-missing"
          className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>Please select a delivery zone before submitting a support request.</span>
          <button
            type="button"
            onClick={openPicker}
            className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Choose delivery zone
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-subject" className="sr-only">Subject</label>
          <input
            id="cf-subject"
            data-testid="support-subject"
            type="text"
            placeholder="Subject"
            value={values.subject}
            onChange={update("subject")}
            aria-invalid={!!errors.subject}
            className={fieldBase}
          />
          {errors.subject && <p className="mt-1.5 pl-5 text-xs text-destructive">{errors.subject}</p>}
        </div>
        <div>
          <label htmlFor="cf-category" className="sr-only">Category</label>
          <select
            id="cf-category"
            data-testid="support-category"
            value={values.category}
            onChange={update("category")}
            className={fieldBase}
          >
            {SUPPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-order" className="sr-only">Order number</label>
          <input
            id="cf-order"
            data-testid="support-order-number"
            type="text"
            placeholder="Order number (optional)"
            value={values.orderNumber}
            onChange={update("orderNumber")}
            className={fieldBase}
          />
        </div>
        <div>
          <label htmlFor="cf-phone" className="sr-only">Phone</label>
          <input
            id="cf-phone"
            type="tel"
            autoComplete="tel"
            placeholder="Contact number (optional)"
            value={values.phone}
            onChange={update("phone")}
            className={fieldBase}
          />
        </div>
      </div>

      <div>
        <label htmlFor="cf-message" className="sr-only">Message</label>
        <textarea
          id="cf-message"
          data-testid="support-message"
          rows={6}
          placeholder="Tell us what happened"
          value={values.message}
          onChange={update("message")}
          aria-invalid={!!errors.message}
          maxLength={1000}
          className="w-full resize-y rounded-3xl border border-neutral-200 bg-neutral-50/80 px-5 py-4 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
        />
        <div className="mt-1 flex items-center justify-between pl-5 pr-2 text-xs">
          <span className="text-destructive">{errors.message}</span>
          <span className="text-neutral-400">{values.message.length}/1000</span>
        </div>
      </div>

      <div data-testid="support-attach">
        <input
          ref={fileInputRef}
          id="cf-attachments"
          type="file"
          multiple
          accept={SUPPORT_ATTACHMENT_ACCEPT}
          onChange={onPickFiles}
          className="sr-only"
          data-testid="support-attach-input"
        />
        <label
          htmlFor="cf-attachments"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-white"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach photos or documents
        </label>
        <p className="mt-1 pl-1 text-[11px] text-neutral-400">
          Up to {SUPPORT_ATTACHMENT_MAX_FILES} files, {formatBytes(SUPPORT_ATTACHMENT_MAX_BYTES)} each. Images, PDF or text.
        </p>
        {files.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.size}-${i}`}
                data-testid="support-attach-item"
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2"
              >
                <Paperclip className="h-3.5 w-3.5 flex-none text-neutral-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-neutral-800">{f.name}</span>
                <span className="text-[11px] text-neutral-400">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove ${f.name}`}
                  className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="pt-2">

        <button
          type="submit"
          data-testid="support-submit"
          disabled={submitting || !selected}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#ff003c] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a] hover:shadow-[0_14px_30px_-10px_rgba(255,0,60,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              Submit Request
              <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
