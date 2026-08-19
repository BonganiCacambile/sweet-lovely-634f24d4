import { useEffect, useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import { CommandPalette } from "./command-palette";
import { ConfidentialWatermark } from "./confidential-watermark";
import { useAdminPresence } from "@/lib/admin-presence";
import { getSecurityPosture } from "@/lib/admin/employee-security.functions";
import { useIdleLogout } from "@/lib/admin/use-idle-logout";

export function AdminShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useAdminPresence();

  const posture = useServerFn(getSecurityPosture);
  const { data: security } = useQuery({
    queryKey: ["admin", "security", "posture"],
    queryFn: () => posture(),
    staleTime: 60_000,
  });
  useIdleLogout(security?.idleTimeoutMinutes);
  const mfaGap = Boolean(security?.mfaRequired && !security?.mfaEnrolled);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fff7f8_0%,#fafafa_30%,#ffffff_100%)]">
      <div className="flex min-h-dvh w-full">
        {/* Desktop sidebar */}
        <div className="sticky top-0 hidden h-dvh lg:block">
          <AdminSidebar collapsed={collapsed} />
        </div>

        {/* Mobile drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <>
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-neutral-900/40 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
              <motion.div
                key="drawer"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-y-0 left-0 z-50 lg:hidden"
              >
                <AdminSidebar mobile onCloseMobile={() => setMobileOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            onOpenMobile={() => setMobileOpen(true)}
            onToggleCollapse={() => setCollapsed((v) => !v)}
            collapsed={collapsed}
            onOpenSearch={() => setPaletteOpen(true)}
          />
          <main className="flex-1 px-3 py-5 sm:px-6 sm:py-8">
            {mfaGap ? (
              <div
                data-testid="admin-mfa-required"
                className="mx-auto mb-4 flex w-full max-w-7xl items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span className="flex-1">
                  Two-factor authentication is required for admin accounts. Enrol now to keep access to sensitive
                  operations.
                </span>
                <Link
                  to="/account/security"
                  className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800"
                >
                  Set up 2FA
                </Link>
              </div>
            ) : null}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-7xl"
            >
              <Outlet />
            </motion.div>
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ConfidentialWatermark label={security?.email ?? ""} />
    </div>
  );
}