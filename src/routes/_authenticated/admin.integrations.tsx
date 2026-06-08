import { createFileRoute } from "@tanstack/react-router";
import { Plug } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  component: () => (
    <ComingSoon
      title="Integrations"
      description="Connect payment gateways, APIs and third-party services from one place."
      icon={Plug}
    />
  ),
});