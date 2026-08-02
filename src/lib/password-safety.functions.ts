import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isPasswordBreached } from "./password-safety.server";

export const checkPasswordBreached = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ password: z.string().min(1).max(256) }).parse(data))
  .handler(async ({ data }) => {
    const breached = await isPasswordBreached(data.password);
    return { breached };
  });