// Training 離線快取：程式用「網路優先」（有網路就拿最新版），圖片用「快取優先」（看過一次就離線可用）
const VER = '__VER__';
const CORE = ['./', 'index.html', 'manifest.json', 'icon-180.png', 'icon-512.png'];
const IMGS = __IMGS__;
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open('core-' + VER);
    await c.addAll(CORE);
    const ic = await caches.open('img-v1');
    for (const u of IMGS) { try { if (!(await ic.match(u))) await ic.add(u); } catch (err) { } }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('core-') && k !== 'core-' + VER) await caches.delete(k);
    const ic = await caches.open('img-v1');
    for (const req of await ic.keys()) { const p = new URL(req.url).pathname; if (!IMGS.some(u => p.endsWith('/' + u))) await ic.delete(req); }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && (url.pathname.includes('/img/') || url.pathname.includes('/lib/'))) {
    e.respondWith((async () => {
      const c = await caches.open('img-v1');
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    })());
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open('core-' + VER);
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
      catch (err) { return (await c.match(req)) || (await c.match('index.html')) || Response.error(); }
    })());
    return;
  }
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith((async () => {
      const c = await caches.open('font-v1');
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
  }
});
