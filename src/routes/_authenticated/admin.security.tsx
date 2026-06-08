import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/security")({
  component: () => (
    <ComingSoon
      title="Security center"
      description="MFA management, sessions, devices, login history, security events and risk alerts."
      icon={Lock}
    />
  ),
});