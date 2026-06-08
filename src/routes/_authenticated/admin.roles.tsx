import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  component: () => (
    <ComingSoon
      title="Roles & permissions"
      description="Enterprise-grade access control with role matrices, granular permissions and audit history."
      icon={ShieldCheck}
    />
  ),
});