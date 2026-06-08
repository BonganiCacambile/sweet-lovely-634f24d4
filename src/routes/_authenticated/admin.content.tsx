import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/content")({
  component: () => (
    <ComingSoon
      title="Content"
      description="Publish pages, blog posts, banners and promotional content with a modern editor."
      icon={FileText}
    />
  ),
});