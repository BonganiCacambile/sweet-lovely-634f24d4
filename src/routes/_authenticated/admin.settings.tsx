import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: () => (
    <ComingSoon
      title="System settings"
      description="Site info, branding, localisation, security policies, MFA rules and notification templates."
      icon={Settings}
    />
  ),
});