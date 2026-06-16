import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

/**
 * Gates a route to main admins only. Zone admins are redirected back to the
 * admin dashboard with an "Access Restricted" toast.
 */
export function MainAdminGuard({ children }: { children: ReactNode }) {
  const { isMainAdmin, isZoneAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!isMainAdmin && isZoneAdmin) {
      toast.error("Access Restricted", {
        description: "Zone admins can only manage their assigned zone.",
      });
      void navigate({ to: "/admin", replace: true });
    }
  }, [isMainAdmin, isZoneAdmin, loading, navigate]);

  if (!isMainAdmin) return null;
  return <>{children}</>;
}