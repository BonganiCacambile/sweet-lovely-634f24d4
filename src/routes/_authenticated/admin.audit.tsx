import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: () => (
    <ComingSoon
      title="Audit logs"
      description="A professional, searchable trail of every admin and system action."
      icon={ScrollText}
    />
  ),
});