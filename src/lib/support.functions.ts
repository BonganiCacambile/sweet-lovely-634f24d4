import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const supportSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(1000),
});

export const submitSupportRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => supportSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("support_requests").insert({
      name: data.name,
      email: data.email,
      phone: data.phone ? data.phone : null,
      message: data.message,
      source: "contact_form",
    });
    if (error) {
      console.error("[support] failed to store request", error.message);
      return { ok: false as const, error: "Could not save your message. Please try again." };
    }
    return { ok: true as const };
  });
