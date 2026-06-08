import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: () => (
    <ComingSoon
      title="Categories"
      description="Organise the menu into curated categories with drag-and-drop ordering."
      icon={Tags}
    />
  ),
});