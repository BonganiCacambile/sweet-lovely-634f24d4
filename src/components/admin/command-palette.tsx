import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, BarChart3, Users, ShoppingBag, Package, FileText,
  ShieldCheck, ScrollText, Settings, UserCircle2, Bell, Lock,
} from "lucide-react";

const ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, group: "Main" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, group: "Main" },
  { to: "/admin/users", label: "Users", icon: Users, group: "Main" },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, group: "Main" },
  { to: "/admin/products", label: "Products", icon: Package, group: "Main" },
  { to: "/admin/content", label: "Content", icon: FileText, group: "Main" },
  { to: "/admin/notifications", label: "Notifications", icon: Bell, group: "Management" },
  { to: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, group: "Administration" },
  { to: "/admin/security", label: "Security Center", icon: Lock, group: "Administration" },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText, group: "Administration" },
  { to: "/admin/settings", label: "System Settings", icon: Settings, group: "Administration" },
  { to: "/admin/profile", label: "Profile", icon: UserCircle2, group: "Account" },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const groups = Array.from(new Set(ITEMS.map((i) => i.group)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command>
        <CommandInput placeholder="Search dashboard, users, orders, settings…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {groups.map((g, gi) => (
            <div key={g}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={g}>
                {ITEMS.filter((i) => i.group === g).map((i) => {
                  const Icon = i.icon;
                  return (
                    <CommandItem
                      key={i.to}
                      onSelect={() => {
                        onOpenChange(false);
                        navigate({ to: i.to });
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {i.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}