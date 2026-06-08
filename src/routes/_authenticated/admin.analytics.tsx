import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: () => (
    <ComingSoon
      title="Analytics"
      description="Revenue, growth, engagement, funnels, traffic sources and geographic insights — all in one workspace."
      icon={BarChart3}
    />
  ),
});