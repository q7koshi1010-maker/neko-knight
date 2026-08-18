/* ネコの騎士のぼうけん — オフライン用サービスワーカー
   方式：ネットワーク優先＋キャッシュフォールバック。
   - オンライン時は毎回サーバーから取得し、取れたものをキャッシュに保存（＝更新が確実に反映される）。
   - オフライン時（弓矢…ではなくネットが無いとき）はキャッシュから返す。
   ★ ファイルを更新して古い画面が出る時は、下の VERSION の数字を上げると全キャッシュを作り直す。 */
const VERSION = 'v19';
const CACHE = 'neko-' + VERSION;

// 最初に必ずキャッシュしておくもの（本体＋アイコン＋ショップが<img>で読むSVG）。
// ゲーム中のスプライトは assets.js にデータURI で入っているので、これだけで遊べる。
const CORE = [
  './', 'index.html', 'game.js', 'audio.js', 'assets.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'assets/cat_knight_idle.svg', 'assets/dog_knight_idle.svg', 'assets/seal_mage_idle.svg',
  'assets/penguin_idle.svg', 'assets/panda_idle.svg', 'assets/rabbit_idle.svg', 'assets/cheetah_idle.svg',
  'assets/weapon_gun.svg', 'assets/weapon_axe.svg', 'assets/weapon_bat.svg',
  'assets/weapon_wand.svg', 'assets/weapon_hammer.svg', 'assets/weapon_bow.svg',
  'assets/boots.svg', 'assets/helmet.svg', 'assets/bomb.svg'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  // 各ファイルを HTTP キャッシュ無視(reload)で取り直してからキャッシュ（古い版が入り込まないように）
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // 同一オリジンだけ扱う
  e.respondWith(
    fetch(req, { cache: 'no-cache' })   // 常にサーバーに確認（オンライン時は最新。古いHTTPキャッシュを使わない）
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
