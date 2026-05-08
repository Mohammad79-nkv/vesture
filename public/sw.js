// Vesture service worker — basic shell-cache + offline fallback.
//
// Strategy:
//   - install: pre-cache the offline fallback HTML so it's always
//     available when the network drops.
//   - activate: nuke any old caches from previous deploys (the
//     CACHE constant doubles as the version stamp; bump when the
//     shell needs to be re-fetched).
//   - fetch:
//       - skip everything that isn't a same-origin GET — we never
//         want the SW touching API calls, auth flows, third-party
//         (Cloudinary / Clerk / OpenRouter) requests.
//       - navigation requests: network-first, fall through to the
//         cached offline page on failure.
//       - static assets (Next.js _next/static, /icons, fonts):
//         cache-first with background refresh — safe because Next
//         emits content-hashed URLs, so a "cached forever" entry
//         is always for the right build.
//       - everything else: pass-through.
//
// We intentionally don't cache HTML pages aggressively — Server
// Actions + Clerk session cookies make a stale page render
// dangerous. The offline page is the only HTML in cache.

const CACHE = "vesture-shell-v1";
const SHELL_ASSETS = ["/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hard-skip routes the SW must never touch.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/sign-in") ||
    url.pathname.startsWith("/sign-up") ||
    url.pathname.startsWith("/_next/data") ||
    url.pathname.startsWith("/onboarding")
  ) {
    return;
  }

  // Navigation: network-first, offline fallback on failure.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match("/offline.html")) ||
            new Response("Offline", { status: 503 })
          );
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first with background revalidation.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest")
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req);
        if (cached) {
          // Refresh in the background so the cache stays warm
          // without blocking the response.
          fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
            })
            .catch(() => {});
          return cached;
        }
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return new Response("Offline", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Anything else: pass through to the network unchanged.
});
