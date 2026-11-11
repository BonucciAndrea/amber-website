/* sw.js - offline support, as the phone notepad does it. Network first, revalidated (cache: no-cache):
   online, every file comes fresh and refreshes the cache, so an update needs no version bump;
   offline, the cached copy is served. The whole game is cached at install. */
const CACHE = "amber-blackjack";
const FILES = ["./", "index.html", "app.css", "app.js", "rt.js", "amber.wasm", "blackjack.k", "manifest.webmanifest",
  "fonts/JetBrainsMono-Regular.ttf", "fonts/JetBrainsMono-Bold.ttf",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true })));
});
