import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";

function urlBase64ToUint8Array(base64: string) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64Safe);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
}

export type PushSupport = "unsupported" | "checking" | "off" | "on" | "denied";

export function usePushNotifications() {
    const [status, setStatus] = useState<PushSupport>("checking");
    const { data: keyData } = trpc.push.publicKey.useQuery();
    const subscribeMutation = trpc.push.subscribe.useMutation();
    const unsubscribeMutation = trpc.push.unsubscribe.useMutation();

    const supported =
        typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    const refresh = useCallback(async () => {
        if (!supported) {
            setStatus("unsupported");
            return;
        }
        if (Notification.permission === "denied") {
            setStatus("denied");
            return;
        }
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            setStatus(sub ? "on" : "off");
        } catch {
            setStatus("off");
        }
    }, [supported]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const enable = useCallback(async () => {
        if (!supported || !keyData?.key) return false;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            setStatus(permission === "denied" ? "denied" : "off");
            return false;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(keyData.key),
        });
        const json = sub.toJSON();
        await subscribeMutation.mutateAsync({
            endpoint: sub.endpoint,
            keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        });
        setStatus("on");
        return true;
    }, [supported, keyData, subscribeMutation]);

    const disable = useCallback(async () => {
        if (!supported) return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
            await unsubscribeMutation.mutateAsync({ endpoint: sub.endpoint });
            await sub.unsubscribe();
        }
        setStatus("off");
    }, [supported, unsubscribeMutation]);

    return { status, enable, disable };
}