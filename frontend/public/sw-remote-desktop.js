// Service Worker Erweiterung für Remote Desktop Windows

// Bestehender Service Worker Code...

// Handle Window Events
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'OPEN_REMOTE_DESKTOP') {
    // Kann verwendet werden für Offline-Handling oder Caching

  }
});

// Cache Guacamole Assets
const GUACAMOLE_ASSETS = [
  '/guacamole/guacamole-common-js/all.min.js',
  '/guacamole/fonts/',
  '/guacamole/images/'
];

// Optional: Cache Guacamole Resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Cache Guacamole Static Assets
  if (url.pathname.startsWith('/guacamole/') && 
      GUACAMOLE_ASSETS.some(asset => url.pathname.includes(asset))) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          return caches.open('guacamole-v1').then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});