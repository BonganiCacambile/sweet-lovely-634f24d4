import { useEffect, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

/**
 * Gates a route to main admins only. Zone admins are redirected back to the
 * admin dashboard with an "Access Restricted" toast.
 */
export function MainAdminGuard({ children }: { children: ReactNode }) {
  const { user, isMainAdmin, isZoneAdmin, loading } = useAuth();
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

  if (loading) return null;
  if (isMainAdmin) return <>{children}</>;

  const title = !user
    ? "Sign in required"
    : isZoneAdmin
      ? "Access restricted"
      : "Admin access required";
  const description = !user
    ? "You must be signed in as an admin to view this page."
    : isZoneAdmin
      ? "Zone admins can only manage their assigned delivery zone. This section is limited to main admins."
      : "Your account doesn't have permission to access the admin area. If you believe this is a mistake, contact a main admin.";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50/60 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-red-900">{title}</h2>
        <p className="mt-1 text-sm text-red-800/80">{description}</p>
      </div>
      <div className="flex gap-2">
        {!user ? (
          <Link
            to="/auth/admin"
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Sign in
          </Link>
        ) : (
          <Link
            to={isZoneAdmin ? "/admin" : "/account"}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            {isZoneAdmin ? "Back to admin" : "Back to account"}
          </Link>
        )}
      </div>
    </div>
  );
}