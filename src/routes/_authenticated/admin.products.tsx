import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: () => (
    <ComingSoon
      title="Products"
      description="Manage the menu, variants, pricing, availability and product imagery."
      icon={Package}
    />
  ),
});