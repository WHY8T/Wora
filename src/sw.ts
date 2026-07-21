/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkOnly } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
self.addEventListener("activate", () => {
    self.clients.claim();
});

// Same caching behaviour as before: precache the app shell, never cache API calls.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
    new NavigationRoute(createHandlerBoundToURL("index.html"), {
        denylist: [/^\/api\//],
    }),
);
registerRoute(/^\/api\//, new NetworkOnly(), "GET");

/* --------------------------- push notifications --------------------------- */

type PushPayload = { title: string; body: string; url?: string; tag?: string };

self.addEventListener("push", (event) => {
    let payload: PushPayload = { title: "Wora", body: "You have a new notification" };
    if (event.data) {
        try {
            payload = event.data.json();
        } catch {
            payload = { title: "Wora", body: event.data.text() };
        }
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: payload.tag,
            data: { url: payload.url ?? "/" },
            // Most Android/desktop implementations play the default system
            // notification sound automatically; vibrate gives a felt cue too.
            vibrate: [80, 40, 80],
        } as NotificationOptions & { vibrate?: number[] }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";

    event.waitUntil(
        (async () => {
            const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            for (const client of clientList) {
                if ("focus" in client) {
                    if ("navigate" in client) {
                        try {
                            await (client as WindowClient).navigate(url);
                        } catch {
                            /* ignore — fall through to focus */
                        }
                    }
                    return client.focus();
                }
            }
            return self.clients.openWindow(url);
        })(),
    );
});