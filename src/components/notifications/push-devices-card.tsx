import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Loader2, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listMyPushDevices, removePushDevice } from "@/lib/push/push.functions";
import {
  clearDeclined,
  disablePushOnThisDevice,
  enablePushOnThisDevice,
  isEnabledOnThisDevice,
  webPermission,
} from "@/lib/push/push-service";
import { isNativeRuntime } from "@/lib/push/platform";

export function PushDevicesCard() {
  const qc = useQueryClient();
  const list = useServerFn(listMyPushDevices);
  const remove = useServerFn(removePushDevice);
  const [enabledHere, setEnabledHere] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => setEnabledHere(isEnabledOnThisDevice()), []);

  const { data, isLoading } = useQuery({
    queryKey: ["my-push-devices"],
    queryFn: () => list(),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Device removed");
      void qc.invalidateQueries({ queryKey: ["my-push-devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = async () => {
    setBusy(true);
    try {
      if (enabledHere) {
        await disablePushOnThisDevice();
        setEnabledHere(false);
        toast.success("Notifications paused on this device");
      } else {
        clearDeclined();
        const res = await enablePushOnThisDevice();
        if (res.ok) {
          setEnabledHere(true);
          toast.success("Notifications enabled on this device");
        } else if (res.reason === "denied") {
          toast.error("Your browser blocked notifications — allow them in site settings");
        } else {
          toast.error(res.message ?? "Notifications aren't available on this device");
        }
      }
      void qc.invalidateQueries({ queryKey: ["my-push-devices"] });
    } finally {
      setBusy(false);
    }
  };

  const devices = data?.devices ?? [];
  const unsupported = !isNativeRuntime() && webPermission() === "unsupported";

  return (
    <div data-testid="push-devices-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Push notifications</p>
          <p className="mt-1 text-xs text-neutral-500">
            Register this device to receive order updates when the app is in the background or closed.
          </p>
        </div>
        <button
          type="button"
          data-testid="push-toggle-device"
          onClick={() => void toggle()}
          disabled={busy || unsupported}
          className={
            "inline-flex flex-none items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50 " +
            (enabledHere
              ? "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              : "bg-[#ff003c] text-white")
          }
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : enabledHere ? (
            <BellOff className="h-3.5 w-3.5" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          {enabledHere ? "Pause here" : "Enable on this device"}
        </button>
      </div>

      {unsupported ? (
        <p className="mt-3 text-xs text-neutral-500">
          This browser doesn't support notifications. Install the mobile app to get push alerts.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-xs text-neutral-500">Loading devices…</p>
        ) : devices.length === 0 ? (
          <p className="text-xs text-neutral-500">No devices registered yet.</p>
        ) : (
          devices.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Smartphone className="h-4 w-4 flex-none text-neutral-400" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-neutral-800">
                    {d.device_name ?? d.platform}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {d.platform} · {d.provider} · {d.is_active ? "active" : "paused"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => del.mutate(d.id)}
                className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-[#ff003c]"
                aria-label="Remove device"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}