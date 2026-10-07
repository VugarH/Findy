// Service worker for price-drop push notifications. It does nothing else:
// no caching, no offline mode.

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    // A push without a readable payload still deserves a generic notice.
  }
  event.waitUntil(
    self.registration.showNotification(message.title || "Sərfəli", {
      body: message.body || "",
      icon: "/favicon.ico",
      data: { url: message.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only ever open a page on this site.
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === target.href);
      return open ? open.focus() : self.clients.openWindow(target.href);
    }),
  );
});
