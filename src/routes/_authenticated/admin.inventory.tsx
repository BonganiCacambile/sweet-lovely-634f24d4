import { createFileRoute } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: () => (
    <ComingSoon
      title="Inventory"
      description="Track stock, set low-stock alerts and reconcile counts across locations."
      icon={Boxes}
    />
  ),
});