import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Message can't be empty").max(1000),
});

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "message", string>>;

export function ContactForm() {
  const [values, setValues] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      toast.success("Message sent — we'll get back to you soon!");
      setValues({ name: "", email: "", phone: "", message: "" });
    } finally {
      setSubmitting(false);
    }
  };

  const fieldBase =
    "w-full rounded-full border border-neutral-200 bg-neutral-50/80 px-5 py-3.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all outline-none focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="cf-name" className="sr-only">Full Name</label>
        <input
          id="cf-name"
          type="text"
          autoComplete="name"
          placeholder="Full Name"
          value={values.name}
          onChange={update("name")}
          aria-invalid={!!errors.name}
          className={fieldBase}
        />
        {errors.name && <p className="mt-1.5 pl-5 text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cf-email" className="sr-only">Email</label>
          <input
            id="cf-email"
            type="email"
            autoComplete="email"
            placeholder="youremail@email.com"
            value={values.email}
            onChange={update("email")}
            aria-invalid={!!errors.email}
            className={fieldBase}
          />
          {errors.email && <p className="mt-1.5 pl-5 text-xs text-destructive">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="cf-phone" className="sr-only">Phone</label>
          <input
            id="cf-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+01 000 999 555"
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
          rows={6}
          placeholder="Type your message"
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

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#ff003c] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(255,0,60,0.7)] transition-all hover:-translate-y-0.5 hover:bg-[#e6003a] hover:shadow-[0_14px_30px_-10px_rgba(255,0,60,0.55)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              Send Message
              <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}