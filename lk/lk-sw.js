self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (_) {
    payload = { title: 'FictoData', body: event.data ? event.data.text() : 'Новое уведомление' }
  }

  const title = payload.title || 'FictoData'
  const body = payload.body || 'Есть обновление по карточке'
  const url = payload.url || '/lk/#/tracker'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url },
      tag: payload.tag || 'fictodata-notify',
      renotify: true,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/lk/#/tracker'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return clients.openWindow(target)
    }),
  )
})
