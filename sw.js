self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "GLAVASKOP Organizer", {
      body: data.body || "Imate novi podsjetnik.",
      icon: "/images/hero.jpeg",
      badge: "/images/hero.jpeg",
      data: { url: data.url || "/admin/organizer/kalendar" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/admin/organizer"));
});
