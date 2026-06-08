import { createFileRoute } from "@tanstack/react-router";
import { UserCircle2 } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/profile")({
  component: () => (
    <ComingSoon
      title="Admin profile"
      description="Manage your administrator profile, MFA enrolment and notification preferences."
      icon={UserCircle2}
    />
  ),
});