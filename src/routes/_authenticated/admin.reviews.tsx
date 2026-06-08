import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { ComingSoon } from "@/components/admin/coming-soon";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  component: () => (
    <ComingSoon
      title="Reviews"
      description="Moderate customer reviews, respond and surface trending feedback."
      icon={Star}
    />
  ),
});