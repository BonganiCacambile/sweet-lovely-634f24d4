import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: () => (
    <ComingSoon
      title="Orders"
      description="Live order pipeline, fulfilment status, refunds and customer history."
      icon={ShoppingBag}
    />
  ),
});