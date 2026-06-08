import { createFileRoute } from "@tanstack/react-router";
import { FileBarChart2 } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: () => (
    <ComingSoon
      title="Reports"
      description="Scheduled and ad-hoc reports across sales, operations and customer behaviour."
      icon={FileBarChart2}
    />
  ),
});