/* Cisterna Viva — service worker.
   Troque VERSION a cada publicação para renovar o cache dos arquivos do app. */
const VERSION = 'v3';
const CORE_CACHE = 'cisterna-viva-core-' + VERSION;
const MEDIA_CACHE = 'cisterna-viva-media-' + VERSION;
const CORE = ['./', './index.html', './css/styles.css', './js/data.js', './js/app.js',
  './assets/images/brand/cisterna-viva-logo.png', './assets/images/brand/cisterna-viva-wordmark.png'];
const MEDIA_HOSTS = ['images.pexels.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const MEDIA_MAX = 60;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE_CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('cisterna-viva-') && k !== CORE_CACHE && k !== MEDIA_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MEDIA_MAX) await Promise.all(keys.slice(0, keys.length - MEDIA_MAX).map(k => cache.delete(k)));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fotos e fontes externas: usa a cópia salva e atualiza em segundo plano.
  if (MEDIA_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(MEDIA_CACHE).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { cache.put(req, res.clone()).then(() => trim(cache)); }
        return res;
      }).catch(() => null);
      return hit || (await net) || Response.error();
    }));
    return;
  }

  // Qualquer outro site (ex.: API do IBGE) não passa pelo service worker.
  if (url.origin !== location.origin) return;

  // Páginas: rede primeiro, cópia salva se estiver offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CORE_CACHE).then(c => c.put('./index.html', copy)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Arquivos do app: cópia salva primeiro, com atualização em segundo plano.
  e.respondWith(caches.open(CORE_CACHE).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || Response.error();
  }));
});
