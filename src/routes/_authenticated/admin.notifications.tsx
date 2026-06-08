import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: () => (
    <ComingSoon
      title="Notifications"
      description="Security alerts, user registrations, payment events and system updates in real time."
      icon={Bell}
    />
  ),
});