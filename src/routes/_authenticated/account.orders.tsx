import { createFileRoute } from "@tanstack/react-router";
import { AccountShell, Card } from "@/components/auth/account-shell";
import { ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account/orders")({
  head: () => ({ meta: [{ title: "Your orders — Pepper" }] }),
  component: () => (
    <AccountShell title="Orders">
      <Card>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff003c]">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <p className="text-base font-semibold text-neutral-900">No orders yet</p>
          <p className="mt-1 text-sm text-neutral-500">When you place your first order it'll show up here.</p>
        </div>
      </Card>
    </AccountShell>
  ),
});