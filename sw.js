/* Only the static app shell is cached. Personnel and backups stay in local storage or Files. */
const prefix = "personnel-ledger:" + self.registration.scope + ":";
const revision = "1.15-release-1";
const cacheName = prefix + revision;
const files = [
  "./","app.css","app.js","core.js","people.css","people.js","policy.css","policy.js",
  "iphone.js","iphone.css","manifest.webmanifest","touch-icon.png","icon-192.png","icon-512.png"
];
function assetURL(file) {
  const url = new URL(file, self.registration.scope);
  url.searchParams.set("v", revision);
  return url.href;
}
self.addEventListener("install",event => {
  event.waitUntil((async() => {
    const cache = await caches.open(cacheName);
    await cache.addAll(files.map(file => new Request(assetURL(file),{cache:"reload"})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event => {
  event.waitUntil((async() => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(prefix) && key!==cacheName).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("message",event => {
  if (!event.data || event.data.type !== "verify-shell" || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      const cached = new Set((await cache.keys()).map(item => item.url));
      const missing = files.filter(file => !cached.has(assetURL(file)));
      if (missing.length) await cache.addAll(missing.map(file => new Request(assetURL(file),{cache:"reload"})));
      event.ports[0].postMessage({revision,complete:true});
    } catch (_) {event.ports[0].postMessage({revision,complete:false});}
  })());
});
self.addEventListener("fetch",event => {
  const url = new URL(event.request.url);
  const localPath = url.href.slice(self.registration.scope.length).split(/[?#]/)[0];
  if(event.request.method !== "GET" || !url.href.startsWith(self.registration.scope)) return;
  const file = localPath === "" || localPath === "index.html" ? "./" : localPath;
  if (!files.includes(file)) return;
  event.respondWith((async() => {
    const cache = await caches.open(cacheName);
    return (await cache.match(assetURL(file))) || fetch(event.request);
  })());
});
