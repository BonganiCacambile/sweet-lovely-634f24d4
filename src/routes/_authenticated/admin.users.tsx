import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: () => (
    <ComingSoon
      title="User management"
      description="Search, filter and manage every Sweet & Lovely member with rich profiles, activity and account actions."
      icon={Users}
    />
  ),
});